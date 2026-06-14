import {
  clampOffset,
  cloneOffsets,
  createEmptyLinkDeltas,
  createEmptyLinks,
} from "../../../lib/lockData";
import type { AppStateData, Direction } from "../../../lib/types";
import type { PlateLinkingPromptTask } from "./types";

export function createPlateLinkingPromptTask(
  state: AppStateData,
  driver: number,
  delta: number,
): PlateLinkingPromptTask {
  const direction: Direction = delta < 0 ? "up" : "down";
  return {
    phase: "move",
    driver,
    delta,
    direction,
    startOffsets: cloneOffsets(state.offsets),
    baseOffsets: null,
    observations: Array.from({ length: state.plateCount }, () => 0),
    blockedObservations: Array.from({ length: state.plateCount }, () => 0),
  };
}

export function advancePlateLinkingPrompt(state: AppStateData): AppStateData {
  if (state.mode !== "linking" || state.linkingPromptTask?.phase !== "move") {
    return state;
  }

  const offsets = cloneOffsets(state.offsets);
  offsets[state.linkingPromptTask.driver] = clampOffset(
    state.linkingPromptTask.startOffsets[state.linkingPromptTask.driver] + state.linkingPromptTask.delta,
  );

  return {
    ...state,
    offsets,
    linkingPromptTask: {
      ...state.linkingPromptTask,
      phase: "observe",
      baseOffsets: cloneOffsets(offsets),
      observations: Array.from({ length: state.plateCount }, () => 0),
      blockedObservations: Array.from({ length: state.plateCount }, () => 0),
    },
  };
}

export function updatePlateLinkingObservation(
  state: AppStateData,
  index: number,
  nextOffset: number,
): AppStateData {
  if (state.mode !== "linking" || state.linkingPromptTask?.phase !== "observe" || index === state.linkingPromptTask.driver) {
    return state;
  }

  const offsets = cloneOffsets(state.offsets);
  offsets[index] = nextOffset;

  return {
    ...state,
    offsets,
    linkingPromptTask: {
      ...state.linkingPromptTask,
      observations: state.linkingPromptTask.observations.map((value, observationIndex) => (
        observationIndex === index
          ? nextOffset - (state.linkingPromptTask?.baseOffsets?.[index] ?? nextOffset)
          : value
      )),
      blockedObservations: state.linkingPromptTask.blockedObservations.map((value, observationIndex) => (
        observationIndex === index ? 0 : value
      )),
    },
  };
}

export function recordBlockedPlateLinkingObservation(
  state: AppStateData,
  index: number,
  attemptedDelta: number,
): AppStateData {
  if (
    state.mode !== "linking"
    || state.linkingPromptTask?.phase !== "observe"
    || index === state.linkingPromptTask.driver
    || attemptedDelta === 0
  ) {
    return state;
  }

  return {
    ...state,
    linkingPromptTask: {
      ...state.linkingPromptTask,
      observations: state.linkingPromptTask.observations.map((value, observationIndex) => (
        observationIndex === index ? 0 : value
      )),
      blockedObservations: state.linkingPromptTask.blockedObservations.map((value, observationIndex) => (
        observationIndex === index ? Math.sign(attemptedDelta) : value
      )),
    },
  };
}

export function stepBackPlateLinkingPrompt(state: AppStateData): AppStateData {
  if (state.mode !== "linking" || !state.linkingPromptTask) {
    return state;
  }

  if (state.linkingPromptTask.phase !== "move") {
    return {
      ...state,
      offsets: cloneOffsets(state.linkingPromptTask.startOffsets),
      linkingPromptTask: {
        ...state.linkingPromptTask,
        phase: "move",
        baseOffsets: null,
        observations: Array.from({ length: state.plateCount }, () => 0),
        blockedObservations: Array.from({ length: state.plateCount }, () => 0),
      },
    };
  }

  return {
    ...state,
    mode: "setup",
    linkingStartOffsets: null,
    links: createEmptyLinks(state.plateCount),
    linkDeltas: createEmptyLinkDeltas(state.plateCount),
    linkingPromptTask: null,
    plateLinkingProcedure: null,
    solution: null,
    offsets: cloneOffsets(state.linkingStartOffsets || state.offsets),
  };
}

export function getPlateLinkingOffsetBounds(state: AppStateData, index: number) {
  if (state.mode !== "linking" || !state.linkingPromptTask) {
    return { min: state.offsets[index], max: state.offsets[index] };
  }

  if (state.linkingPromptTask.phase === "move" || state.linkingPromptTask.phase === "complete" || index === state.linkingPromptTask.driver) {
    return { min: state.offsets[index], max: state.offsets[index] };
  }

  const baseOffset = state.linkingPromptTask.baseOffsets?.[index] ?? state.offsets[index];
  return {
    min: clampOffset(baseOffset - 1),
    max: clampOffset(baseOffset + 1),
  };
}

export function getPlateLinkingObservation(state: AppStateData, index: number): number {
  if (state.mode !== "linking" || state.linkingPromptTask?.phase !== "observe") {
    return 0;
  }

  return state.linkingPromptTask.blockedObservations[index]
    || state.offsets[index] - (state.linkingPromptTask.baseOffsets?.[index] ?? state.offsets[index]);
}
