import { CENTER_INDEX, cloneOffsets, createInitialAppState, resizeLink, resizeLinkDeltas } from "../../lib/lockData";
import { buildSolutionPlanForApp } from "../plate-linking/implementation";
import { buildSolutionCommandString, buildWasdSequence } from "../../lib/solution";
import { beginNextLinkTask } from "../plate-linking/linkingState";

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
    deferredLinkTasks: [],
    linkTaskHistory: [],
    currentSaveId: savedLock.id,
    solution: savedLock.isDraft ? null : buildSolutionPlanForApp(savedLock, cloneOffsets(savedLock.linkingStartOffsets || savedLock.currentOffsets)),
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

export { buildSolutionCommandString, buildWasdSequence };
