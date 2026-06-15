import { CENTER_INDEX, clampOffset } from "./lockData";
import { getPlateLinkingObservation, getPlateLinkingOffsetBounds } from "../screens/plate-linking/prompt/plateLinkingPromptState";

export function getOffsetBounds(state, index) {
  if (state.mode === "setup") {
    return { min: -CENTER_INDEX, max: CENTER_INDEX };
  }

  if (state.mode === "linking") {
    return getPlateLinkingOffsetBounds(state, index);
  }

  if (state.mode === "manual_linking") {
    const manual = state.manualLinkingState;
    if (!manual) {
      return { min: state.offsets[index], max: state.offsets[index] };
    }

    const selectedDriver = manual.selectedDriver;
    if (manual.phase === "define-links" && selectedDriver !== null && selectedDriver !== undefined) {
      if (index === selectedDriver) {
        return { min: manual.offsets[index], max: manual.offsets[index] };
      }

      return { min: -999, max: 999 };
    }

    return { min: -999, max: 999 };
  }

  if (state.mode === "testing") {
    return {
      min: clampOffset(state.offsets[index] - 1),
      max: clampOffset(state.offsets[index] + 1),
    };
  }

  return { min: state.offsets[index], max: state.offsets[index] };
}

export function canMove(state, index, direction) {
  const delta = direction === "up" ? -1 : 1;

  if (state.mode === "linking" && state.linkingPromptTask?.phase === "observe" && index !== state.linkingPromptTask.driver) {
    return true;
  }

  if (state.mode === "manual_linking" && state.manualLinkingState?.phase === "define-links" && index !== state.manualLinkingState.selectedDriver) {
    return true;
  }

  if (state.mode === "manual_linking" && state.manualLinkingState?.phase === "choose-driver") {
    return true;
  }

  if (state.mode === "testing") {
    return Boolean(state.links[index]);
  }

  const bounds = getOffsetBounds(state, index);
  const nextOffset = state.offsets[index] + delta;
  return nextOffset >= bounds.min && nextOffset <= bounds.max;
}

export function getPlateObservation(state, index) {
  return getPlateLinkingObservation(state, index);
}

export function hasPlateObservation(state) {
  if (state.mode !== "linking" || !state.linkingPromptTask || state.linkingPromptTask.phase !== "observe") {
    return false;
  }

  return state.offsets.some((_, index) => index !== state.linkingPromptTask.driver && getPlateObservation(state, index) !== 0);
}
