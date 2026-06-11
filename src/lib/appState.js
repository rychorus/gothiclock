import { cloneOffsets, createEmptyLinks, createInitialAppState, resizeLink, resizeOffsets } from "./lockData";
import { buildSolutionPlan } from "./solution";
import { beginNextLinkTask } from "./linkingState";

function getSolutionStartOffsets(state) {
  return cloneOffsets(state.linkingStartOffsets || state.offsets);
}

export function snapshotCurrentCountState(state) {
  return {
    ...state.snapshotsByCount,
    [state.plateCount]: {
      offsets: cloneOffsets(state.offsets),
      links: state.links.map((link) => resizeLink(link, state.plateCount)),
      linkingStartOffsets: state.linkingStartOffsets ? cloneOffsets(state.linkingStartOffsets) : null,
      mode: state.mode,
    },
  };
}

export function startNewLock(state) {
  return {
    ...createInitialAppState(),
    plateCount: state.plateCount,
    offsets: Array.from({ length: state.plateCount }, () => 0),
    links: createEmptyLinks(state.plateCount),
    snapshotsByCount: {},
    mode: "setup",
  };
}

export function setPlateCount(state, count) {
  const snapshotsByCount = snapshotCurrentCountState(state);
  const existingSnapshot = snapshotsByCount[count];
  const previousOffsets = cloneOffsets(state.offsets);
  const previousLinks = [...state.links];
  const previousStartOffsets = state.linkingStartOffsets ? cloneOffsets(state.linkingStartOffsets) : null;
  const previousMode = state.mode;

  const nextState = {
    ...state,
    snapshotsByCount,
    plateCount: count,
    offsets: existingSnapshot ? cloneOffsets(existingSnapshot.offsets) : resizeOffsets(previousOffsets, count),
    links: existingSnapshot
      ? existingSnapshot.links.map((link) => resizeLink(link, count))
      : Array.from({ length: count }, (_, index) => resizeLink(previousLinks[index], count)),
    mode: existingSnapshot?.mode ?? previousMode,
    linkingStartOffsets: existingSnapshot?.linkingStartOffsets
      ? cloneOffsets(existingSnapshot.linkingStartOffsets)
      : previousStartOffsets
        ? resizeOffsets(previousStartOffsets, count)
        : null,
    currentTask: null,
    solution: null,
  };

  if (nextState.mode === "setup" || !nextState.linkingStartOffsets) {
    return nextState;
  }

  if (nextState.mode === "solution" || nextState.mode === "ready_to_solve") {
    return {
      ...nextState,
      mode: "ready_to_solve",
      solution: buildSolutionPlan(nextState, getSolutionStartOffsets(nextState)),
    };
  }

  return beginNextLinkTask(nextState);
}

export function startOver(state) {
  return {
    ...state,
    snapshotsByCount: snapshotCurrentCountState(state),
    offsets: Array.from({ length: state.plateCount }, () => 0),
    links: createEmptyLinks(state.plateCount),
    mode: "setup",
    linkingStartOffsets: null,
    currentTask: null,
    solution: null,
  };
}

export function setSolutionStep(state, index) {
  if (!state.solution?.chunks?.length) {
    return state;
  }

  const clampedIndex = Math.max(0, Math.min(index, state.solution.chunks.length - 1));
  return {
    ...state,
    offsets: cloneOffsets(state.solution.chunks[clampedIndex].offsets),
    solution: {
      ...state.solution,
      index: clampedIndex,
    },
  };
}

export function loadSavedLockState(state, savedLock) {
  const nextState = {
    ...state,
    plateCount: savedLock.plateCount,
    offsets: cloneOffsets(savedLock.currentOffsets || savedLock.linkingStartOffsets),
    linkingStartOffsets: savedLock.linkingStartOffsets ? cloneOffsets(savedLock.linkingStartOffsets) : null,
    links: savedLock.links.map((link) => resizeLink(link, savedLock.plateCount)),
    mode: savedLock.isDraft ? "linking" : "solution",
    currentTask: null,
    currentSaveId: savedLock.id,
    solution: savedLock.isDraft ? null : buildSolutionPlan(savedLock, cloneOffsets(savedLock.linkingStartOffsets || savedLock.currentOffsets)),
    snapshotsByCount: {},
  };

  if (savedLock.isDraft) {
    return beginNextLinkTask(nextState);
  }

  return {
    ...nextState,
    offsets: cloneOffsets(savedLock.linkingStartOffsets || savedLock.currentOffsets),
  };
}
