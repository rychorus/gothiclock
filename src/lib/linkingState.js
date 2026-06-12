import {
  CENTER_INDEX,
  clampOffset,
  cloneOffsets,
  createEmptyLinkDeltas,
  createEmptyLinks,
  createIdentityLink,
  chooseNextDriver,
  getSuggestedDelta,
  getUnknownPlates,
} from "./lockData";
import { buildSolutionPlan } from "./solution";

function getSolutionStartOffsets(state) {
  return cloneOffsets(state.linkingStartOffsets || state.offsets);
}

function cloneLinkTask(task) {
  if (!task) {
    return null;
  }

  return {
    ...task,
    startOffsets: task.startOffsets ? cloneOffsets(task.startOffsets) : null,
    baseOffsets: task.baseOffsets ? cloneOffsets(task.baseOffsets) : null,
    attempts: task.attempts ? [...task.attempts] : [],
  };
}

function rebaseOffsets(offsets, snapshotOffsets, currentOffsets) {
  if (!offsets) {
    return null;
  }

  return offsets.map((value, index) => value + (currentOffsets[index] - snapshotOffsets[index]));
}

function rebaseDeferredTask(task, snapshotOffsets, currentOffsets) {
  const clonedTask = cloneLinkTask(task);
  if (!clonedTask) {
    return null;
  }

  return {
    ...clonedTask,
    startOffsets: rebaseOffsets(clonedTask.startOffsets, snapshotOffsets, currentOffsets),
    baseOffsets: rebaseOffsets(clonedTask.baseOffsets, snapshotOffsets, currentOffsets),
  };
}

function getStep2Selection(task, offsets, index) {
  const actualDelta = offsets[index] - task.baseOffsets[index];
  if (actualDelta !== 0) {
    return actualDelta;
  }

  return task.attempts?.[index] || 0;
}

function hasBlockedSelection(task, offsets) {
  return offsets.some((offset, index) => (
    index !== task.driver
    && (task.attempts?.[index] || 0) !== 0
    && offset === task.baseOffsets[index]
  ));
}

function getDriverMovedOffset(task) {
  return clampOffset(task.startOffsets[task.driver] + task.delta);
}

function syncStep2DriverState(state) {
  if (state.mode !== "linking" || state.currentTask?.phase !== "step2") {
    return state;
  }

  const task = cloneLinkTask(state.currentTask);
  const offsets = cloneOffsets(state.offsets);
  const driverOffset = hasBlockedSelection(task, offsets)
    ? task.startOffsets[task.driver]
    : getDriverMovedOffset(task);

  offsets[task.driver] = driverOffset;
  task.baseOffsets[task.driver] = driverOffset;

  return {
    ...state,
    offsets,
    currentTask: task,
  };
}

function applyKnownBlockedLinks(state) {
  if (state.mode !== "linking" || state.currentTask?.phase !== "step2") {
    return state;
  }

  const task = cloneLinkTask(state.currentTask);
  const offsets = cloneOffsets(state.offsets);
  if (hasBlockedSelection(task, offsets)) {
    return {
      ...state,
      offsets,
      currentTask: task,
    };
  }

  const processed = new Set();
  const pending = [];

  for (let index = 0; index < state.plateCount; index += 1) {
    if (index === task.driver) {
      continue;
    }

    const selection = getStep2Selection(task, offsets, index);
    if (selection !== 0 && offsets[index] === task.baseOffsets[index] && state.links[index]) {
      pending.push(index);
    }
  }

  while (pending.length) {
    const blockedIndex = pending.shift();
    if (processed.has(blockedIndex)) {
      continue;
    }
    processed.add(blockedIndex);

    const selection = getStep2Selection(task, offsets, blockedIndex);
    const normalizedLink = state.links[blockedIndex];
    if (!selection || !normalizedLink) {
      continue;
    }

    for (let index = 0; index < state.plateCount; index += 1) {
      if (index === task.driver || index === blockedIndex) {
        continue;
      }

      const inferredDelta = normalizedLink[index] * selection;
      if (!inferredDelta || getStep2Selection(task, offsets, index) !== 0) {
        continue;
      }

      const inferredOffset = task.baseOffsets[index] + inferredDelta;
      if (inferredOffset >= -CENTER_INDEX && inferredOffset <= CENTER_INDEX) {
        offsets[index] = inferredOffset;
        continue;
      }

      task.attempts[index] = Math.sign(inferredDelta);
      if (state.links[index]) {
        pending.push(index);
      }
    }
  }

  return {
    ...state,
    offsets,
    currentTask: task,
  };
}

function beginDeferredBlockedTask(state, blockedIndex) {
  const deferredLinkTasks = [
    ...(state.deferredLinkTasks || []),
    {
      task: cloneLinkTask(state.currentTask),
      offsets: cloneOffsets(state.offsets),
    },
  ];

  return startLinkTaskForDriver(
    {
      ...state,
      deferredLinkTasks,
    },
    blockedIndex,
  );
}

function resumeDeferredBlockedTask(state) {
  const deferredLinkTasks = [...(state.deferredLinkTasks || [])];
  if (!deferredLinkTasks.length) {
    return state;
  }

  const deferredTask = deferredLinkTasks.pop();
  const currentOffsets = cloneOffsets(state.offsets);
  const rebasedTask = rebaseDeferredTask(deferredTask.task, deferredTask.offsets, currentOffsets);

  return {
    ...state,
    deferredLinkTasks,
    offsets: currentOffsets,
    currentTask: {
      ...rebasedTask,
      phase: "step1",
      startOffsets: cloneOffsets(currentOffsets),
      baseOffsets: null,
      attempts: Array.from({ length: state.plateCount }, () => 0),
    },
    mode: "linking",
  };
}

function startLinkTaskForDriver(state, driver) {
  const delta = getSuggestedDelta(state.offsets[driver]);

  return {
    ...state,
    currentTask: {
      phase: "step1",
      driver,
      delta,
      direction: delta === -1 ? "up" : "down",
      startOffsets: cloneOffsets(state.offsets),
    },
  };
}

export function beginNextLinkTask(state) {
  const driver = chooseNextDriver(state);

  if (driver === null || driver === undefined) {
    const links = state.links.map((link, index) => link || createIdentityLink(state.plateCount, index));
    return enterSolutionMode({ ...state, links });
  }

  return startLinkTaskForDriver(state, driver);
}

export function startLinkingMode(state) {
  const isAligned = state.offsets.every((offset) => offset === 0);

  if (isAligned) {
    const nextState = {
      ...state,
      mode: "solution",
      links: createEmptyLinks(state.plateCount),
      linkDeltas: createEmptyLinkDeltas(state.plateCount),
      linkingStartOffsets: cloneOffsets(state.offsets),
      currentTask: null,
    };

    return {
      ...nextState,
      solution: buildSolutionPlan(nextState, cloneOffsets(state.offsets)),
    };
  }

  return beginNextLinkTask({
    ...state,
    deferredLinkTasks: [],
    mode: "linking",
    links: createEmptyLinks(state.plateCount),
    linkDeltas: createEmptyLinkDeltas(state.plateCount),
    linkingStartOffsets: cloneOffsets(state.offsets),
    solution: null,
  });
}

export function stepBackLinking(state) {
  if (state.mode !== "linking" || !state.currentTask) {
    return state;
  }

  if (state.currentTask.phase === "step2") {
    return {
      ...state,
      offsets: cloneOffsets(state.currentTask.startOffsets),
      currentTask: {
        ...state.currentTask,
        phase: "step1",
        startOffsets: cloneOffsets(state.currentTask.startOffsets),
      },
    };
  }

  if ((state.deferredLinkTasks || []).length) {
    return resumeDeferredBlockedTask({
      ...state,
      deferredLinkTasks: [...state.deferredLinkTasks],
    });
  }

  const previousKnownIndex = [...state.links]
    .map((link, index) => ({ link, index }))
    .reverse()
    .find(({ link }) => Boolean(link))
    ?.index;

  if (previousKnownIndex === undefined) {
    return {
      ...state,
      offsets: cloneOffsets(state.linkingStartOffsets || state.offsets),
      links: createEmptyLinks(state.plateCount),
      linkDeltas: createEmptyLinkDeltas(state.plateCount),
      currentTask: null,
      mode: "setup",
    };
  }

  const links = [...state.links];
  const linkDeltas = [...(state.linkDeltas || [])];
  links[previousKnownIndex] = null;
  linkDeltas[previousKnownIndex] = null;
  let offsets = cloneOffsets(state.linkingStartOffsets || state.offsets);

  for (let index = 0; index < links.length; index += 1) {
    if (!links[index]) {
      continue;
    }

    const normalizedLink = links[index];
    const delta = linkDeltas[index] ?? (
      normalizedLink[index] === 1
        ? (normalizedLink.some((value, linkIndex) => linkIndex !== index && value === -1) ? 1 : -1)
        : -1
    );
    if (delta === 0) {
      continue;
    }

    const change = normalizedLink.map((value) => value * delta);
    offsets = offsets.map((value, offsetIndex) => value + change[offsetIndex]);
  }

  return beginNextLinkTask({
    ...state,
    links,
    linkDeltas,
    offsets,
  });
}

export function resetPlates(state) {
  if (!state.linkingStartOffsets || state.mode === "solution" || state.mode === "ready_to_solve") {
    return state;
  }

  const nextState = {
    ...state,
    offsets: cloneOffsets(state.linkingStartOffsets),
  };

  if (state.mode === "linking") {
    // If a step2 task exists with recorded attempts, avoid re-selecting
    // the same driver immediately after a reset to prevent repeated
    // break-loop situations from the physical game reset.
    if (state.currentTask?.phase === "step2" && state.currentTask.attempts?.some((a) => a !== 0)) {
      const offsetsCopy = cloneOffsets(nextState.offsets);
      offsetsCopy[state.currentTask.driver] = 0;
      return beginNextLinkTask({
        ...nextState,
        offsets: offsetsCopy,
      });
    }

    return beginNextLinkTask(nextState);
  }

  return nextState;
}

export function advanceFromStep1(state) {
  if (!state.currentTask || state.currentTask.phase !== "step1") {
    return state;
  }

  const { driver, delta, startOffsets } = state.currentTask;
  const offsets = cloneOffsets(state.offsets);
  offsets[driver] = clampOffset(startOffsets[driver] + delta);

  return {
    ...state,
    offsets,
    currentTask: {
      ...state.currentTask,
      phase: "step2",
      baseOffsets: cloneOffsets(offsets),
      attempts: Array.from({ length: state.plateCount }, () => 0),
    },
  };
}

export function finishLinkCapture(state) {
  if (!state.currentTask || state.currentTask.phase !== "step2") {
    return state;
  }

  const syncedState = syncStep2DriverState(state);
  const driverBlocked = hasBlockedSelection(syncedState.currentTask, syncedState.offsets);
  const preparedState = driverBlocked ? syncedState : applyKnownBlockedLinks(syncedState);
  const { driver, delta, baseOffsets, attempts = [] } = preparedState.currentTask;
  const finalOffsets = driverBlocked
    ? cloneOffsets(preparedState.currentTask.startOffsets)
    : cloneOffsets(preparedState.offsets);

  const blockedSelections = preparedState.offsets
    .map((offset, index) => ({
      index,
      offset,
      attempted: attempts[index] || 0,
      known: Boolean(preparedState.links[index]),
    }))
    .filter(({ index, offset, attempted }) => (
      index !== driver
      && attempted !== 0
      && offset === baseOffsets[index]
    ));

  if (!driverBlocked) {
    const blockedUnknownPlates = blockedSelections
      .filter(({ known }) => !known)
      .map(({ index }) => index);

    if (blockedUnknownPlates.length) {
      return beginDeferredBlockedTask(preparedState, blockedUnknownPlates[0]);
    }
  }

  if (driverBlocked) {
    const blockedUnknownPlates = blockedSelections
      .filter(({ known }) => !known)
      .map(({ index }) => index);

    if (blockedUnknownPlates.length) {
      return beginDeferredBlockedTask(
        {
          ...preparedState,
          offsets: finalOffsets,
        },
        blockedUnknownPlates[0],
      );
    }
  }

  const normalizedLink = preparedState.offsets.map((offset, index) => {
    if (index === driver) {
      return 1;
    }

    const actualDelta = offset - baseOffsets[index];
    const observedDelta = actualDelta !== 0 ? actualDelta : attempts[index] || 0;
    return Math.round(observedDelta / delta);
  });

  const links = [...preparedState.links];
  const linkDeltas = [...(preparedState.linkDeltas || createEmptyLinkDeltas(preparedState.plateCount))];
  links[driver] = normalizedLink;
  linkDeltas[driver] = driverBlocked ? 0 : delta;
  const nextState = {
    ...preparedState,
    links,
    linkDeltas,
    offsets: finalOffsets,
  };

  if ((preparedState.deferredLinkTasks || []).length) {
    return resumeDeferredBlockedTask(nextState);
  }

  if (getUnknownPlates(links).length === 0) {
    return enterSolutionMode(nextState);
  }

  return beginNextLinkTask(nextState);
}

export function enterSolutionMode(state) {
  const startOffsets = getSolutionStartOffsets(state);
  const nextState = {
    ...state,
    deferredLinkTasks: [],
    mode: "solution",
    currentTask: null,
    offsets: cloneOffsets(startOffsets),
  };

  return {
    ...nextState,
    solution: buildSolutionPlan(nextState, startOffsets),
  };
}

export function updatePlateOffset(state, index, nextOffset, attemptedDirection = 0) {
  const offsets = cloneOffsets(state.offsets);
  offsets[index] = nextOffset;
  const nextState = { ...state, offsets };

  if (state.mode === "linking" && state.currentTask?.phase === "step2" && index !== state.currentTask.driver) {
    const attempts = [...state.currentTask.attempts];
    attempts[index] = attemptedDirection;
    nextState.currentTask = {
      ...state.currentTask,
      attempts,
    };
  }

  return syncStep2DriverState(nextState);
}

export function recordPlateAttempt(state, index, attemptedDirection) {
  if (state.mode !== "linking" || state.currentTask?.phase !== "step2" || index === state.currentTask.driver) {
    return state;
  }

  const attempts = [...state.currentTask.attempts];
  attempts[index] = attemptedDirection;
  return syncStep2DriverState({
    ...state,
    currentTask: {
      ...state.currentTask,
      attempts,
    },
  });
}
