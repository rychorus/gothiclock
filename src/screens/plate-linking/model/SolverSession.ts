import type { Offsets, PlateLinkingStateData, SolutionPlanData, SolverInteractionData, SolverPromptData, SolverSessionData } from "../../../lib/types";

/**
 * Mutable-by-return session state for the custom interactive solver.
 *
 * The session tracks the current prompt, the recorded interactions, the last
 * observed app state snapshot, and the final solution plan once the session is
 * complete.
 */
export class SolverSession implements SolverSessionData {
  status: "collecting" | "complete";
  prompt: SolverPromptData | null;
  interactions: SolverInteractionData[];
  state: PlateLinkingStateData | null;
  startOffsets: Offsets | null;
  solution: SolutionPlanData | null;

  constructor({
    status = "collecting",
    prompt = null,
    interactions = [],
    state = null,
    startOffsets = null,
    solution = null,
  }: Partial<SolverSessionData> = {}) {
    this.status = status;
    this.prompt = prompt;
    this.interactions = interactions;
    this.state = state;
    this.startOffsets = startOffsets;
    this.solution = solution;
  }
}
