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

function dedupeIndices(indices) {
  return [...new Set(indices)].sort((a, b) => a - b);
}

function appendTaskHistory(state, task) {
  if (!task) {
    return state;
  }

  return {
    ...state,
    linkTaskHistory: [...(state.linkTaskHistory || []), cloneLinkTask(task)],
  };
}

function rebuildOffsetsFromLinks(state, links, linkDeltas) {
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

  return offsets;
}

function getDeferredRequirements(state, deferredTask) {
  if (Array.isArray(deferredTask.blockedRequirements) && deferredTask.blockedRequirements.length) {
    return deferredTask.blockedRequirements;
  }

  return (deferredTask.blockedBy || []).map((index) => ({
    index,
    delta: deferredTask.task?.attempts?.[index] || 0,
  }));
}

function isDeferredBlockerActive(state, deferredTask, index) {
  if (getUnknownPlates(state.links).includes(index)) {
    return true;
  }

  const requirement = getDeferredRequirements(state, deferredTask).find((entry) => entry.index === index);
  const requiredDelta = requirement?.delta || 0;
  if (!requiredDelta) {
    return false;
  }

  const nextOffset = (state.offsets?.[index] ?? 0) + requiredDelta;
  return nextOffset < -CENTER_INDEX || nextOffset > CENTER_INDEX;
}

function pruneDeferredLinkTasks(state) {
  return (state.deferredLinkTasks || [])
    .map((deferredTask) => ({
      ...deferredTask,
      driver: deferredTask.driver ?? deferredTask.task?.driver,
      blockedRequirements: getDeferredRequirements(state, deferredTask).filter(({ index }) => (
        index !== (deferredTask.driver ?? deferredTask.task?.driver)
        && isDeferredBlockerActive(state, deferredTask, index)
      )),
      blockedBy: dedupeIndices(
        getDeferredRequirements(state, deferredTask)
          .filter(({ index }) => (
            index !== (deferredTask.driver ?? deferredTask.task?.driver)
            && isDeferredBlockerActive(state, deferredTask, index)
          ))
          .map(({ index }) => index),
      ),
    }))
    .filter((deferredTask) => deferredTask.driver !== undefined && deferredTask.driver !== null);
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

function beginDeferredBlockedTask(state, blockedIndexes) {
  const blockedBy = dedupeIndices(blockedIndexes.filter((index) => index !== state.currentTask.driver));
  const blockedRequirements = blockedBy.map((index) => ({
    index,
    delta: state.currentTask.attempts?.[index] || 0,
  }));
  const currentDriver = state.currentTask.driver;
  const deferredTasks = pruneDeferredLinkTasks(state).filter((deferredTask) => deferredTask.driver !== currentDriver);

  deferredTasks.push({
    driver: currentDriver,
    blockedBy,
    blockedRequirements,
    task: cloneLinkTask(state.currentTask),
    offsets: cloneOffsets(state.offsets),
  });

  return beginNextLinkTask({
    ...state,
    currentTask: null,
    deferredLinkTasks: deferredTasks,
  }, {
    excludeDrivers: [currentDriver],
  });
}

function resumeDeferredBlockedTask(state, driver = null) {
  const deferredLinkTasks = pruneDeferredLinkTasks(state);
  if (!deferredLinkTasks.length) {
    return state;
  }

  const deferredIndex = driver === null
    ? deferredLinkTasks.length - 1
    : deferredLinkTasks.findIndex((deferredTask) => deferredTask.driver === driver);

  if (deferredIndex < 0) {
    return state;
  }

  const [deferredTask] = deferredLinkTasks.splice(deferredIndex, 1);
  const currentOffsets = cloneOffsets(state.offsets);
  const rebasedTask = rebaseDeferredTask(deferredTask.task, deferredTask.offsets, currentOffsets);

  return {
    ...state,
    deferredLinkTasks,
    offsets: currentOffsets,
    currentTask: {
      ...rebasedTask,
      wasDeferred: true,
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

export function beginNextLinkTask(state, options = {}) {
  const normalizedState = {
    ...state,
    deferredLinkTasks: pruneDeferredLinkTasks(state),
  };

  const driver = chooseNextDriver(normalizedState, options.excludeDrivers || []);

  if (driver === null || driver === undefined) {
    if (normalizedState.deferredLinkTasks.length) {
      return {
        ...normalizedState,
        mode: "linking",
        currentTask: null,
      };
    }

    const links = normalizedState.links.map((link, index) => link || createIdentityLink(normalizedState.plateCount, index));
    return enterSolutionMode({ ...normalizedState, links });
  }

  if (normalizedState.deferredLinkTasks.some((deferredTask) => deferredTask.driver === driver)) {
    return resumeDeferredBlockedTask(normalizedState, driver);
  }

  return startLinkTaskForDriver(normalizedState, driver);
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

  const history = [...(state.linkTaskHistory || [])];
  const previousTask = history.pop();
  if (previousTask) {
    const links = [...state.links];
    const linkDeltas = [...(state.linkDeltas || [])];
    links[previousTask.driver] = null;
    linkDeltas[previousTask.driver] = null;

    return {
      ...state,
      linkTaskHistory: history,
      offsets: rebuildOffsetsFromLinks(state, links, linkDeltas),
      links,
      linkDeltas,
      currentTask: {
        ...cloneLinkTask(previousTask),
        phase: "step1",
        startOffsets: cloneOffsets(previousTask.startOffsets || state.offsets),
        baseOffsets: null,
        attempts: Array.from({ length: state.plateCount }, () => 0),
        wasDeferred: Boolean(previousTask.wasDeferred),
      },
      mode: "linking",
    };
  }

  return {
    ...state,
    offsets: cloneOffsets(state.linkingStartOffsets || state.offsets),
    links: createEmptyLinks(state.plateCount),
    linkDeltas: createEmptyLinkDeltas(state.plateCount),
    currentTask: null,
    mode: "setup",
  };
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
  const committedState = {
    ...preparedState,
    offsets: finalOffsets,
    links,
    linkDeltas,
  };

  if (blockedSelections.length) {
    return beginDeferredBlockedTask(committedState, blockedSelections.map(({ index }) => index));
  }

  const nextState = {
    ...appendTaskHistory(committedState, preparedState.currentTask),
    deferredLinkTasks: pruneDeferredLinkTasks({
      ...committedState,
      links,
    }).filter((deferredTask) => deferredTask.driver !== driver),
  };

  if (getUnknownPlates(links).length === 0) {
    if ((nextState.deferredLinkTasks || []).length) {
      return beginNextLinkTask(nextState);
    }

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
