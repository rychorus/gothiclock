import { CENTER_INDEX, clampOffset } from "./lockData";

export function getOffsetBounds(state, index) {
  if (state.mode === "setup") {
    return { min: -CENTER_INDEX, max: CENTER_INDEX };
  }

  if (state.mode === "linking" && state.currentTask) {
    if (state.currentTask.phase === "step1") {
      return { min: state.offsets[index], max: state.offsets[index] };
    }

    if (state.currentTask.phase === "step2") {
      const baseOffset = state.currentTask.baseOffsets[index];
      if (index === state.currentTask.driver) {
        return { min: baseOffset, max: baseOffset };
      }

      return {
        min: clampOffset(baseOffset - 1),
        max: clampOffset(baseOffset + 1),
      };
    }
  }

  return { min: state.offsets[index], max: state.offsets[index] };
}

export function canMove(state, index, direction) {
  const delta = direction === "up" ? -1 : 1;

  if (state.mode === "linking" && state.currentTask?.phase === "step2" && index !== state.currentTask.driver) {
    return true;
  }

  const bounds = getOffsetBounds(state, index);
  const nextOffset = state.offsets[index] + delta;
  return nextOffset >= bounds.min && nextOffset <= bounds.max;
}

export function getStep2Selection(state, index) {
  if (state.mode !== "linking" || !state.currentTask || state.currentTask.phase !== "step2") {
    return 0;
  }

  const actualDelta = state.offsets[index] - state.currentTask.baseOffsets[index];
  if (actualDelta !== 0) {
    return actualDelta;
  }

  return state.currentTask.attempts?.[index] || 0;
}

export function hasAnyStep2Selection(state) {
  if (state.mode !== "linking" || !state.currentTask || state.currentTask.phase !== "step2") {
    return false;
  }

  return state.offsets.some((_, index) => index !== state.currentTask.driver && getStep2Selection(state, index) !== 0);
}
