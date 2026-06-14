import type { AppMode } from "../../../lib/types";

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

export interface SolutionMoveData {
  plate: number;
  delta: number;
  direction: Direction;
}

export interface SolutionKeyGroupData {
  key: string;
  count: number;
}

export interface SolutionChunkData {
  id: string;
  type: "reset" | "move" | "solved";
  label: string;
  keys: string[];
  keyGroups: SolutionKeyGroupData[];
  offsets: Offsets;
  move: SolutionMoveData | null;
}

export interface SolutionPlanData {
  moves: SolutionMoveData[] | null;
  chunks: SolutionChunkData[];
  index: number;
  startOffsets: Offsets;
}

export interface SolverPromptData {
  kind: "idle" | "move" | "observe" | "complete";
  message: string;
  plateIndex: number | null;
  direction: Direction | null;
  hint: string;
}

export interface SolverInteractionData {
  kind: string;
  plateIndex?: number | null;
  direction?: Direction | null;
  offset?: number | null;
  phase?: string | null;
  details?: Record<string, unknown> | null;
  timestamp?: number;
}

export interface SolverSessionData {
  status: "collecting" | "complete";
  prompt: SolverPromptData | null;
  interactions: SolverInteractionData[];
  state: PlateLinkingStateData | null;
  startOffsets: Offsets | null;
  solution: SolutionPlanData | null;
}

export interface StartOffsetsData {
  values: Offsets;
}

export interface PlateLinkingStateData {
  plateCount: number;
  offsets: Offsets;
  links: PlateLinks;
  linkDeltas: LinkDeltas;
  linkingStartOffsets: Offsets | null;
  mode: AppMode;
  currentTask: LinkTask | null;
  solution: SolutionPlanData | null;
  deferredLinkTasks: DeferredLinkTask[];
  linkTaskHistory: LinkTask[];
  customSolverSession: SolverSessionData | null;
}
