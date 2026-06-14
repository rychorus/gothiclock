import { clampOffset, cloneOffsets } from "../../../lib/lockData";
import type { AppStateData, Direction } from "../../../lib/types";
import type { PlateLinkingPromptTask } from "./types";

function getInitialDriver(offsets: number[]): number {
  const activeDriver = offsets.findIndex((offset) => offset !== 0);
  return activeDriver >= 0 ? activeDriver : 0;
}

function getPromptDirection(offset: number): Direction {
  return offset > 0 ? "up" : "down";
}

export function createPlateLinkingPromptTask(state: AppStateData): PlateLinkingPromptTask {
  const driver = getInitialDriver(state.offsets);
  const direction = getPromptDirection(state.offsets[driver]);
  const delta = direction === "up" ? -1 : 1;

  return {
    phase: "move",
    driver,
    delta,
    direction,
    startOffsets: cloneOffsets(state.offsets),
    baseOffsets: null,
    observations: Array.from({ length: state.plateCount }, () => 0),
  };
}

export function startPlateLinkingPrompt(state: AppStateData): AppStateData {
  const linkingStartOffsets = cloneOffsets(state.offsets);

  return {
    ...state,
    mode: "linking",
    linkingStartOffsets,
    linkingPromptTask: createPlateLinkingPromptTask({ ...state, linkingStartOffsets }),
    solution: null,
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
    },
  };
}

export function completePlateLinkingPrompt(state: AppStateData): AppStateData {
  if (state.mode !== "linking" || state.linkingPromptTask?.phase !== "observe") {
    return state;
  }

  return {
    ...state,
    linkingPromptTask: {
      ...state.linkingPromptTask,
      phase: "complete",
      observations: state.offsets.map((offset, index) => (
        offset - (state.linkingPromptTask?.baseOffsets?.[index] ?? offset)
      )),
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
  };
}

export function resetPlateLinkingPrompt(state: AppStateData): AppStateData {
  if (!state.linkingStartOffsets) {
    return state;
  }

  const offsets = cloneOffsets(state.linkingStartOffsets);
  return {
    ...state,
    offsets,
    linkingPromptTask: createPlateLinkingPromptTask({ ...state, offsets }),
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
      },
    };
  }

  return {
    ...state,
    mode: "setup",
    linkingPromptTask: null,
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

  return state.offsets[index] - (state.linkingPromptTask.baseOffsets?.[index] ?? state.offsets[index]);
}
