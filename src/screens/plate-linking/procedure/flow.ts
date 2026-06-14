import { clampOffset, cloneOffsets, createEmptyLinkDeltas, createEmptyLinks } from "../../../lib/lockData";
import type { AppStateData } from "../../../lib/types";
import type { LinkTask, PlateLinks } from "../model/types";
import { appendTaskHistory, cloneLinkTask, pruneDeferredLinkTasks, rebuildOffsetsFromLinks } from "./helpers";
import { applyKnownBlockedLinks, hasBlockedSelection, syncStep2DriverState } from "./step2";
import { beginNextLinkTask, enterSolutionMode } from "./tasking";
import { USE_CUSTOM_SOLUTION } from "../implementation/solutionMode";
import { finalizeSolverSession, initializeSolverSession, withSolverInteraction } from "../implementation/custom/session";

export function startLinkingMode(state: AppStateData): AppStateData {
  const isAligned = state.offsets.every((offset) => offset === 0);

  const linkingState: AppStateData = {
    ...state,
    deferredLinkTasks: [],
    mode: "linking",
    links: createEmptyLinks(state.plateCount),
    linkDeltas: createEmptyLinkDeltas(state.plateCount),
    linkingStartOffsets: cloneOffsets(state.offsets),
    solution: null,
  };

  const sessionState = USE_CUSTOM_SOLUTION ? initializeSolverSession(linkingState) : linkingState;

  if (isAligned) {
    const solutionState: AppStateData = {
      ...sessionState,
      mode: "solution",
      currentTask: null,
    };

    return {
      ...solutionState,
      solution: enterSolutionMode(solutionState).solution,
    };
  }

  return beginNextLinkTask(sessionState);
}

export function stepBackLinking(state: AppStateData): AppStateData {
  if (state.mode !== "linking" || !state.currentTask) {
    return state;
  }

  if (state.currentTask.phase === "step2") {
    return withSolverInteraction({
      ...state,
      offsets: cloneOffsets(state.currentTask.startOffsets),
      currentTask: {
        ...state.currentTask,
        phase: "step1",
        startOffsets: cloneOffsets(state.currentTask.startOffsets),
      },
    } as AppStateData, { kind: "step_back", phase: "step2", plateIndex: state.currentTask.driver });
  }

  const history = [...(state.linkTaskHistory || [])];
  const previousTask = history.pop();
  if (previousTask) {
    const links = [...state.links];
    const linkDeltas = [...(state.linkDeltas || [])];
    links[previousTask.driver] = null;
    linkDeltas[previousTask.driver] = null;

    return withSolverInteraction({
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
    } as AppStateData, { kind: "step_back", phase: "step1", plateIndex: previousTask.driver });
  }

  return withSolverInteraction({
    ...state,
    offsets: cloneOffsets(state.linkingStartOffsets || state.offsets),
    links: createEmptyLinks(state.plateCount),
    linkDeltas: createEmptyLinkDeltas(state.plateCount),
    currentTask: null,
    mode: "setup",
  } as AppStateData, { kind: "step_back", phase: "setup" });
}

export function resetPlates(state: AppStateData): AppStateData {
  if (!state.linkingStartOffsets || state.mode === "solution" || state.mode === "ready_to_solve") {
    return state;
  }

  const nextState: AppStateData = {
    ...state,
    offsets: cloneOffsets(state.linkingStartOffsets),
  };

  if (state.mode === "linking") {
    return withSolverInteraction(beginNextLinkTask(nextState), { kind: "reset_plates" });
  }

  return withSolverInteraction(nextState, { kind: "reset_plates" });
}

export function advanceFromStep1(state: AppStateData): AppStateData {
  if (!state.currentTask || state.currentTask.phase !== "step1") {
    return state;
  }

  const { driver, delta, startOffsets } = state.currentTask;
  const offsets = cloneOffsets(state.offsets);
  offsets[driver] = clampOffset(startOffsets[driver] + delta);

  return withSolverInteraction({
    ...state,
    offsets,
    currentTask: {
      ...state.currentTask,
      phase: "step2",
      baseOffsets: cloneOffsets(offsets),
      attempts: Array.from({ length: state.plateCount }, () => 0),
    },
  } as AppStateData, { kind: "advance_step1", plateIndex: driver });
}

export function finishLinkCapture(state: AppStateData): AppStateData {
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

  const trackedState = withSolverInteraction({
    ...appendTaskHistory(committedState, preparedState.currentTask),
    deferredLinkTasks: pruneDeferredLinkTasks({
      ...committedState,
      links,
    }).filter((deferredTask) => deferredTask.driver !== driver),
  }, { kind: "finish_link_capture", plateIndex: driver, phase: "step2" });

  if (preparedState.links.every(Boolean)) {
    if ((trackedState.deferredLinkTasks || []).length) {
      return beginNextLinkTask(trackedState);
    }

    return enterSolutionMode(trackedState);
  }

  return beginNextLinkTask(trackedState);
}
