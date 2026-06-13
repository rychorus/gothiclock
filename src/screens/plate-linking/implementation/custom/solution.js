import { PlateLinkingState, SolutionChunk, SolutionKeyGroup, SolutionMove, SolutionPlan, StartOffsets } from "../../model";

/**
 * Edit this file first.
 *
 * Use:
 * - `buildSimpleSolutionPlan(session)` to make a solution
 * - `session.state` for the current plates
 * - `session.interactions` for the user moves/clicks
 * - `session.startOffsets` for the starting offsets
 */
/**
 * Turn the session state into a `PlateLinkingState`.
 */
function normalizeState(session) {
  return session instanceof PlateLinkingState ? session : new PlateLinkingState(session?.state ?? session);
}

/**
 * Read the starting offsets from the session.
 */
function normalizeStartOffsets(session, state) {
  if (session?.startOffsets instanceof StartOffsets) {
    return [...session.startOffsets.values];
  }

  if (Array.isArray(session?.startOffsets)) {
    return [...session.startOffsets];
  }

  if (Array.isArray(session?.startOffsets?.values)) {
    return [...session.startOffsets.values];
  }

  return Array.from({ length: state.plateCount }, () => 0);
}

/**
 * Build a tiny example solution plan.
 */
export function buildSimpleSolutionPlan(session) {
  const state = normalizeState(session);
  const startOffsets = normalizeStartOffsets(session, state);
  const links = Array.isArray(state.links) ? state.links : [];
  const moves = [];
  let offsets = [...startOffsets];

  // Walk the plates once and make one simple move for each linked plate.
  for (let plate = 0; plate < state.plateCount; plate += 1) {
    if (!Array.isArray(links[plate])) {
      continue;
    }

    const delta = offsets[plate] > 0 ? -1 : 1;
    if (offsets[plate] !== 0) {
      moves.push(new SolutionMove({
        plate,
        delta,
        direction: delta === -1 ? "up" : "down",
      }));
      offsets = offsets.map((value, index) => value + (links[plate][index] * delta));
    }
  }

  // Build the minimal plan shown by the solution screen.
  const solved = offsets.every((value) => value === 0);
  return new SolutionPlan({
    moves: solved ? moves : null,
    chunks: [
      new SolutionChunk({
        id: "reset",
        type: "reset",
        label: "R",
        keys: ["R"],
        keyGroups: [new SolutionKeyGroup({ key: "R" })],
        offsets: [...startOffsets],
      }),
      new SolutionChunk({
        id: "solved",
        type: "solved",
        label: solved ? "Solved" : "Not solved",
        keys: [],
        keyGroups: [new SolutionKeyGroup({ key: solved ? "Solved" : "Not solved" })],
        offsets,
      }),
    ],
    index: 0,
    startOffsets,
  });
}

/**
 * App-facing solver entry point.
 */
export function buildSolutionPlanFromSession(session) {
  return session?.solution ?? buildSimpleSolutionPlan(session);
}

/**
 * Backward-compatible wrapper for the app.
 */
export function buildSolutionPlan(session) {
  return buildSolutionPlanFromSession(session);
}
