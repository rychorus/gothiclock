import { CENTER_INDEX, clampOffset, cloneOffsets } from "../../lib/lockData";
import { cloneLinkTask } from "./linkingState.helpers";

export function getStep2Selection(task, offsets, index) {
  const actualDelta = offsets[index] - task.baseOffsets[index];
  if (actualDelta !== 0) {
    return actualDelta;
  }

  return task.attempts?.[index] || 0;
}

export function hasBlockedSelection(task, offsets) {
  return offsets.some((offset, index) => (
    index !== task.driver
    && (task.attempts?.[index] || 0) !== 0
    && offset === task.baseOffsets[index]
  ));
}

export function getDriverMovedOffset(task) {
  return clampOffset(task.startOffsets[task.driver] + task.delta);
}

export function syncStep2DriverState(state) {
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

export function applyKnownBlockedLinks(state) {
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
