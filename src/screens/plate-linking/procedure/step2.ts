import { CENTER_INDEX, clampOffset, cloneOffsets } from "../../../lib/lockData";
import type { AppStateData } from "../../../lib/types";
import type { LinkTask } from "../model/types";
import { cloneLinkTask } from "./helpers";
import { withSolverInteraction } from "../implementation/custom/session";

export function getStep2Selection(task: LinkTask, offsets: number[], index: number) {
  const actualDelta = offsets[index] - task.baseOffsets[index];
  if (actualDelta !== 0) {
    return actualDelta;
  }

  return task.attempts?.[index] || 0;
}

export function hasBlockedSelection(task: LinkTask, offsets: number[]) {
  return offsets.some((offset, index) => (
    index !== task.driver
    && (task.attempts?.[index] || 0) !== 0
    && offset === task.baseOffsets[index]
  ));
}

export function getDriverMovedOffset(task: LinkTask) {
  return clampOffset(task.startOffsets[task.driver] + task.delta);
}

export function syncStep2DriverState(state: AppStateData): AppStateData {
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

export function applyKnownBlockedLinks(state: AppStateData): AppStateData {
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

export function updatePlateOffset(state: AppStateData, index: number, nextOffset: number, attemptedDirection = 0): AppStateData {
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

  return withSolverInteraction(syncStep2DriverState(nextState), {
    kind: "drag_plate",
    plateIndex: index,
    offset: nextOffset,
    details: { attemptedDirection },
  });
}

export function recordPlateAttempt(state: AppStateData, index: number, attemptedDirection: number): AppStateData {
  if (state.mode !== "linking" || state.currentTask?.phase !== "step2" || index === state.currentTask.driver) {
    return state;
  }

  const attempts = [...state.currentTask.attempts];
  attempts[index] = attemptedDirection;
  return withSolverInteraction(syncStep2DriverState({
    ...state,
    currentTask: {
      ...state.currentTask,
      attempts,
    },
  }), {
    kind: "attempt_plate",
    plateIndex: index,
    details: { attemptedDirection },
  });
}
