/**
 * Mutable-by-return session state for the custom interactive solver.
 *
 * The session tracks the current prompt, the recorded interactions, the last
 * observed app state snapshot, and the final solution plan once the session is
 * complete.
 */
export class SolverSession {
  constructor({
    status = "collecting",
    prompt = null,
    interactions = [],
    state = null,
    startOffsets = null,
    solution = null,
  } = {}) {
    this.status = status;
    this.prompt = prompt;
    this.interactions = interactions;
    this.state = state;
    this.startOffsets = startOffsets;
    this.solution = solution;
  }
}
