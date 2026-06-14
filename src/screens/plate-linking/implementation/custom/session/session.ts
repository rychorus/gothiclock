import { PlateLinkingState, SolverInteraction, SolverPrompt, SolverSession, StartOffsets } from "../../../model";
import type { AppStateData, Direction, LinkTask, Offsets, PlateLinkingStateData, SolverInteractionData, SolverSessionData, StartOffsetsData } from "../../../../../lib/types";
import { buildSolutionPlanFromSession } from "../solution";

function buildPromptFromState(state: PlateLinkingState): SolverPrompt {
  if (!state?.currentTask) {
    return new SolverPrompt({
      kind: "idle",
      message: "Use plate moves and clicks to gather linking information.",
      hint: "The session records each interaction.",
    });
  }

  const driverIndex = state.plateCount - (state.currentTask.driver ?? 0);
  if (state.currentTask.phase === "step2") {
    return new SolverPrompt({
      kind: "observe",
      message: `Observe what moved with plate ${driverIndex}.`,
      plateIndex: state.currentTask.driver ?? null,
      direction: state.currentTask.direction ?? null,
      hint: "Move plates or click through the linked plates to record the result.",
    });
  }

  return new SolverPrompt({
    kind: "move",
    message: `Move plate ${driverIndex} ${state.currentTask.direction === "up" ? "left" : "right"}.`,
    plateIndex: state.currentTask.driver ?? null,
    direction: state.currentTask.direction ?? null,
    hint: "The session will record the move and update its prompt automatically.",
  });
}

function normalizeState(state: PlateLinkingStateData | PlateLinkingState): PlateLinkingState {
  return state instanceof PlateLinkingState ? state : new PlateLinkingState(state);
}

function normalizeStartOffsets(startOffsets: Offsets | StartOffsetsData | StartOffsets | null | undefined, state: PlateLinkingState): Offsets {
  if (startOffsets instanceof StartOffsets) {
    return [...startOffsets.values];
  }

  if (Array.isArray(startOffsets)) {
    return [...startOffsets];
  }

  if (startOffsets && "values" in startOffsets && Array.isArray(startOffsets.values)) {
    return [...startOffsets.values];
  }

  return Array.from({ length: state.plateCount }, () => 0);
}

/**
 * Create the interactive session object that React stores while the player
 * is moving plates.
 */
export function createSolverSession(state: PlateLinkingStateData | PlateLinkingState, startOffsets: Offsets | StartOffsets | null = null): SolverSession {
  const normalizedState = normalizeState({ ...state, customSolverSession: null });
  return new SolverSession({
    status: "collecting",
    prompt: buildPromptFromState(normalizedState),
    interactions: [],
    state: normalizedState,
    startOffsets: normalizeStartOffsets(startOffsets ?? normalizedState.linkingStartOffsets ?? normalizedState.offsets, normalizedState),
    solution: null,
  });
}

/**
 * Record one plate-linking interaction inside the session.
 */
export function recordSolverInteraction(session: SolverSession | null, interaction: SolverInteractionData, nextState: PlateLinkingStateData | PlateLinkingState | null = null): SolverSession | null {
  if (!session) {
    return session;
  }

  const normalizedState = nextState ? normalizeState({ ...nextState, customSolverSession: null }) : session.state;
  return new SolverSession({
    ...session,
    state: normalizedState,
    prompt: buildPromptFromState(normalizedState),
    interactions: [...session.interactions, new SolverInteraction(interaction)],
  });
}

/**
 * Attach a fresh solver session to an app-state object.
 */
export function initializeSolverSession(state: AppStateData): AppStateData {
  return {
    ...state,
    customSolverSession: createSolverSession(state),
  };
}

/**
 * Record the interaction and keep the session attached to the current state.
 */
export function withSolverInteraction(state: AppStateData, interaction: SolverInteractionData): AppStateData {
  if (!state.customSolverSession) {
    return state;
  }

  return {
    ...state,
    customSolverSession: recordSolverInteraction(state.customSolverSession, interaction, state),
  };
}

/**
 * Convert the live session into its final solution object.
 */
export function completeSolverSession(session: SolverSession | null): SolverSession | null {
  if (!session) {
    return session;
  }

  return new SolverSession({
    ...session,
    status: "complete",
    solution: buildSolutionPlanFromSession(session),
    prompt: new SolverPrompt({
      kind: "complete",
      message: "Solver session complete.",
    }),
  });
}

/**
 * Finalize the custom solver state stored on the app object.
 */
export function finalizeSolverSession(state: AppStateData): AppStateData {
  if (!state.customSolverSession) {
    return state;
  }

  const completeSession = completeSolverSession(state.customSolverSession);
  return {
    ...state,
    customSolverSession: completeSession,
    solution: completeSession.solution,
  };
}
