import { createEmptyLinkDeltas, createEmptyLinks, createInitialAppState, resizeLink, resizeLinkDeltas, resizeOffsets } from "../../lib/lockData";
import { buildSolutionPlanForApp } from "../plate-linking/implementation";
import { beginNextLinkTask } from "../plate-linking/linkingState";

export function snapshotCurrentCountState(state) {
  return {
    ...state.snapshotsByCount,
    [state.plateCount]: {
      offsets: resizeOffsets(state.offsets, state.plateCount),
      links: state.links.map((link) => resizeLink(link, state.plateCount)),
      linkDeltas: resizeLinkDeltas(state.linkDeltas, state.plateCount),
      linkingStartOffsets: state.linkingStartOffsets ? resizeOffsets(state.linkingStartOffsets, state.plateCount) : null,
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
  const previousOffsets = state.offsets.slice();
  const previousLinks = [...state.links];
  const previousStartOffsets = state.linkingStartOffsets ? [...state.linkingStartOffsets] : null;
  const previousMode = state.mode;
  const previousCount = state.plateCount;
  const deltaCount = count - previousCount;

  function rebaseTask(task) {
    if (!task) return null;
    const newDriver = task.driver + deltaCount;
    if (newDriver < 0 || newDriver >= count) return null;

    function rebaseArray(arr) {
      if (!arr) return null;
      if (deltaCount > 0) {
        const next = Array.from({ length: count }, () => 0);
        for (let i = 0; i < arr.length; i += 1) {
          next[i + deltaCount] = arr[i];
        }
        return next;
      }
      if (deltaCount < 0) {
        return arr.slice(-count);
      }
      return Array.from({ length: count }, (_, i) => arr[i] ?? 0);
    }

    return {
      ...task,
      driver: newDriver,
      startOffsets: rebaseArray(task.startOffsets),
      baseOffsets: rebaseArray(task.baseOffsets),
      attempts: rebaseArray(task.attempts) || Array.from({ length: count }, () => 0),
    };
  }

  const nextState = {
    ...state,
    snapshotsByCount,
    plateCount: count,
    offsets: (function () {
      if (deltaCount > 0) {
        const next = Array.from({ length: count }, () => 0);
        for (let i = 0; i < previousOffsets.length; i += 1) {
          next[i + deltaCount] = previousOffsets[i];
        }
        return next;
      }
      if (deltaCount < 0) {
        return previousOffsets.slice(-count);
      }
      return resizeOffsets(previousOffsets, count);
    })(),
    links: (function () {
      if (deltaCount > 0) {
        const next = Array.from({ length: count }, () => null);
        for (let i = 0; i < previousLinks.length; i += 1) {
          next[i + deltaCount] = resizeLink(previousLinks[i], count);
        }
        return next;
      }
      if (deltaCount < 0) {
        return Array.from({ length: count }, (_, idx) => resizeLink(previousLinks[idx + (previousCount - count)], count));
      }
      return Array.from({ length: count }, (_, index) => resizeLink(previousLinks[index], count));
    })(),
    linkDeltas: (function () {
      if (deltaCount > 0) {
        const next = Array.from({ length: count }, () => null);
        for (let i = 0; i < (state.linkDeltas || []).length; i += 1) {
          next[i + deltaCount] = state.linkDeltas?.[i] ?? null;
        }
        return next;
      }
      if (deltaCount < 0) {
        return resizeLinkDeltas((state.linkDeltas || []).slice(previousCount - count), count);
      }
      return resizeLinkDeltas(state.linkDeltas, count);
    })(),
    mode: previousMode,
    linkingStartOffsets: previousStartOffsets
      ? (function () {
          if (deltaCount > 0) {
            const next = Array.from({ length: count }, () => 0);
            for (let i = 0; i < previousStartOffsets.length; i += 1) {
              next[i + deltaCount] = previousStartOffsets[i];
            }
            return next;
          }
          if (deltaCount < 0) {
            return previousStartOffsets.slice(-count);
          }
          return resizeOffsets(previousStartOffsets, count);
        })()
      : null,
    currentTask: rebaseTask(state.currentTask),
    deferredLinkTasks: [],
    linkTaskHistory: [],
    solution: state.solution,
  };

  if (existingSnapshot) {
    nextState.offsets = existingSnapshot.offsets;
    nextState.links = existingSnapshot.links;
    nextState.linkDeltas = existingSnapshot.linkDeltas;
    nextState.linkingStartOffsets = existingSnapshot.linkingStartOffsets;
    nextState.mode = existingSnapshot.mode;
  }

  if (nextState.mode === "setup" || !nextState.linkingStartOffsets) {
    return nextState;
  }

  if (nextState.mode === "solution" || nextState.mode === "ready_to_solve") {
    return {
      ...nextState,
      mode: "ready_to_solve",
      solution: buildSolutionPlanForApp(nextState, nextState.linkingStartOffsets),
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
    deferredLinkTasks: [],
    linkTaskHistory: [],
    solution: null,
  };
}
