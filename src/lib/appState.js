import { CENTER_INDEX, cloneOffsets, createEmptyLinkDeltas, createEmptyLinks, createInitialAppState, resizeLink, resizeLinkDeltas, resizeOffsets } from "./lockData";
import { buildSolutionPlan } from "./solution";
import { beginNextLinkTask } from "./linkingState";

function getSolutionStartOffsets(state) {
  return cloneOffsets(state.linkingStartOffsets || state.offsets);
}

export function getSolutionDisplayOffsets(state, index = state.solution?.index ?? 0) {
  if (!state.solution?.chunks?.length) {
    return cloneOffsets(state.offsets);
  }

  const clampedIndex = Math.max(0, Math.min(index, state.solution.chunks.length - 1));
  const selectedChunk = state.solution.chunks[clampedIndex];
  return clampedIndex === 0
    ? cloneOffsets(state.solution.startOffsets || state.solution.chunks[0].offsets)
    : selectedChunk.type === "solved"
      ? cloneOffsets(selectedChunk.offsets)
      : cloneOffsets(state.solution.chunks[clampedIndex - 1].offsets);
}

export function snapshotCurrentCountState(state) {
  return {
    ...state.snapshotsByCount,
    [state.plateCount]: {
      offsets: cloneOffsets(state.offsets),
      links: state.links.map((link) => resizeLink(link, state.plateCount)),
      linkDeltas: resizeLinkDeltas(state.linkDeltas, state.plateCount),
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
    linkDeltas: createEmptyLinkDeltas(state.plateCount),
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
    linkDeltas: existingSnapshot
      ? resizeLinkDeltas(existingSnapshot.linkDeltas, count)
      : resizeLinkDeltas(state.linkDeltas, count),
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
    linkDeltas: createEmptyLinkDeltas(state.plateCount),
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
    offsets: getSolutionDisplayOffsets(state, clampedIndex),
    solution: {
      ...state.solution,
      index: clampedIndex,
    },
  };
}

export function enterTestingMode(state) {
  if (!state.solution) {
    return state;
  }

  return {
    ...state,
    mode: "testing",
    testingFeedback: null,
    currentTask: null,
    offsets: cloneOffsets(state.solution.startOffsets || state.linkingStartOffsets || state.offsets),
  };
}

export function returnToSolutionView(state) {
  if (!state.solution) {
    return state;
  }

  return {
    ...state,
    mode: "solution",
    testingFeedback: null,
    offsets: getSolutionDisplayOffsets(state),
  };
}

export function resetTestingMode(state) {
  if (state.mode !== "testing" || !state.solution) {
    return state;
  }

  return {
    ...state,
    testingFeedback: null,
    offsets: cloneOffsets(state.solution.startOffsets || state.linkingStartOffsets || state.offsets),
  };
}

export function applyTestingMove(state, index, delta) {
  if (state.mode !== "testing" || !state.links[index]) {
    return state;
  }

  const change = state.links[index].map((value) => value * delta);
  const nextOffsets = state.offsets.map((offset, offsetIndex) => offset + change[offsetIndex]);

  if (nextOffsets.some((offset) => offset < -CENTER_INDEX || offset > CENTER_INDEX)) {
    const blockedPlates = change
      .map((value, offsetIndex) => {
        const nextOffset = state.offsets[offsetIndex] + value;
        if (!value || nextOffset >= -CENTER_INDEX && nextOffset <= CENTER_INDEX) {
          return null;
        }

        return offsetIndex;
      })
      .filter((plateIndex) => plateIndex !== null);

    return {
      ...state,
      testingFeedback: {
        id: Date.now(),
        driver: index,
        delta,
        blockedPlates,
      },
    };
  }

  return {
    ...state,
    offsets: nextOffsets,
    testingFeedback: null,
  };
}

export function loadSavedLockState(state, savedLock) {
  const nextState = {
    ...state,
    plateCount: savedLock.plateCount,
    offsets: cloneOffsets(savedLock.currentOffsets || savedLock.linkingStartOffsets),
    linkingStartOffsets: savedLock.linkingStartOffsets ? cloneOffsets(savedLock.linkingStartOffsets) : null,
    links: savedLock.links.map((link) => resizeLink(link, savedLock.plateCount)),
    linkDeltas: resizeLinkDeltas(savedLock.linkDeltas, savedLock.plateCount),
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
