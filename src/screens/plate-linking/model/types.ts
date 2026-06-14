export type Direction = "up" | "down";

export type PlateLink = number[];
export type PlateLinks = Array<PlateLink | null>;
export type Offsets = number[];
export type LinkDeltas = Array<number | null>;

export interface TestingFeedbackData {
  id: number;
  driver: number;
  delta: number;
  blockedPlates: number[];
}

export interface LinkedPlateDelta {
  index: number;
  delta: number;
}

export interface LinkTask {
  phase: "step1" | "step2";
  driver: number;
  delta: number;
  direction: Direction;
  startOffsets: Offsets;
  baseOffsets?: Offsets | null;
  attempts?: number[];
  wasDeferred?: boolean;
}

export interface DeferredLinkTask {
  driver: number;
  blockedBy: number[];
  blockedRequirements: LinkedPlateDelta[];
  task: LinkTask | null;
  offsets: Offsets;
}

export type { SolutionMoveData } from "./SolutionMove";
export type { SolutionKeyGroupData } from "./SolutionKeyGroup";
export type { SolutionChunkData } from "./SolutionChunk";
export type { SolutionPlanData } from "./SolutionPlan";
export type { SolverPromptData } from "./SolverPrompt";
export type { SolverInteractionData } from "./SolverInteraction";
export type { SolverSessionData } from "./SolverSession";
export type { StartOffsetsData } from "./StartOffsets";
export type { PlateLinkingStateData } from "./PlateLinkingState";
