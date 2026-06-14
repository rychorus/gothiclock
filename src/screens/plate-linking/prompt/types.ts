import type { Direction, Offsets } from "../../../lib/types";

export type PlateLinkingPromptPhase = "move" | "observe" | "complete";

export interface PlateLinkingPromptTask {
  phase: PlateLinkingPromptPhase;
  driver: number;
  delta: number;
  direction: Direction;
  startOffsets: Offsets;
  baseOffsets: Offsets | null;
  observations: Offsets;
  blockedObservations: Offsets;
}

export interface PlateLinkingPrompt {
  kind: PlateLinkingPromptPhase;
  message: string;
  hint: string;
  plateIndex: number;
  direction: Direction;
}
