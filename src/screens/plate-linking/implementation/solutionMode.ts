import { buildSolutionPlan as buildExistingSolutionPlan } from "./existing";
import { buildSolutionPlan as buildCustomSolutionPlan } from "./custom/solution";
import { PlateLinkingState, StartOffsets } from "../model";
import type { Offsets } from "../model/types";
import type { PlateLinkingStateData } from "../model/PlateLinkingState";
import type { SolutionPlanData } from "../model/SolutionPlan";

// Flip this to `true` to use the custom implementation in this folder.
export const USE_CUSTOM_SOLUTION = false;

// This is the only selection point. The rest of the app calls this wrapper.
export function buildSolutionPlanForApp(state: PlateLinkingStateData | PlateLinkingState, startOffsets: Offsets | StartOffsets | null | undefined): SolutionPlanData {
  const normalizedState = state instanceof PlateLinkingState ? state : new PlateLinkingState(state);
  const maybeStartOffsets = startOffsets as { values?: Offsets } | null | undefined;
  const normalizedStartOffsets = startOffsets instanceof StartOffsets
    ? startOffsets
    : new StartOffsets(Array.isArray(startOffsets)
      ? startOffsets
      : maybeStartOffsets?.values ?? []);

  if (USE_CUSTOM_SOLUTION) {
    return buildCustomSolutionPlan(normalizedState, normalizedStartOffsets);
  }

  return buildExistingSolutionPlan(normalizedState, normalizedStartOffsets);
}
