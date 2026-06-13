import { buildSolutionPlan as buildExistingSolutionPlan } from "./existing";
import { buildSolutionPlan as buildCustomSolutionPlan } from "./custom/solution.js";
import { PlateLinkingState, StartOffsets } from "../model";

// Flip this to `true` to use the custom implementation in this folder.
export const USE_CUSTOM_SOLUTION = false;

// This is the only selection point. The rest of the app calls this wrapper.
export function buildSolutionPlanForApp(state, startOffsets) {
  const normalizedState = state instanceof PlateLinkingState ? state : new PlateLinkingState(state);
  const normalizedStartOffsets = startOffsets instanceof StartOffsets
    ? startOffsets
    : new StartOffsets(Array.isArray(startOffsets) ? startOffsets : startOffsets?.values ?? []);

  if (USE_CUSTOM_SOLUTION) {
    return buildCustomSolutionPlan(normalizedState, normalizedStartOffsets);
  }

  return buildExistingSolutionPlan(normalizedState, normalizedStartOffsets);
}
