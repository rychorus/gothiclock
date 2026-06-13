import { clampOffset, cloneOffsets, createEmptyLinkDeltas, createEmptyLinks } from "../../lib/lockData";
import { appendTaskHistory, cloneLinkTask, pruneDeferredLinkTasks, rebuildOffsetsFromLinks } from "./linkingState.helpers";
import { applyKnownBlockedLinks, hasBlockedSelection, syncStep2DriverState } from "./linkingState.step2";
import { beginNextLinkTask, enterSolutionMode } from "./linkingState.tasking";

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
      solution: enterSolutionMode(nextState).solution,
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
    const blockedBy = blockedSelections.map(({ index }) => index);
    const blockedRequirements = blockedSelections.map(({ index }) => ({
      index,
      delta: attempts[index] || 0,
    }));
    const deferredTasks = pruneDeferredLinkTasks(committedState).filter((deferredTask) => deferredTask.driver !== driver);

    deferredTasks.push({
      driver,
      blockedBy,
      blockedRequirements,
      task: cloneLinkTask(preparedState.currentTask),
      offsets: cloneOffsets(preparedState.offsets),
    });

    return beginNextLinkTask({
      ...committedState,
      currentTask: null,
      deferredLinkTasks: deferredTasks,
    }, {
      excludeDrivers: [driver],
    });
  }

  const nextState = {
    ...appendTaskHistory(committedState, preparedState.currentTask),
    deferredLinkTasks: pruneDeferredLinkTasks({
      ...committedState,
      links,
    }).filter((deferredTask) => deferredTask.driver !== driver),
  };

  if (preparedState.links.every(Boolean)) {
    if ((nextState.deferredLinkTasks || []).length) {
      return beginNextLinkTask(nextState);
    }

    return enterSolutionMode(nextState);
  }

  return beginNextLinkTask(nextState);
}
