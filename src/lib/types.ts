import type { PlateLinkingPromptTask } from "../screens/plate-linking/prompt/types";
import type { PlateLinkingProcedureState } from "../screens/plate-linking/procedure/types";

export type AppMode = "menu" | "load" | "import" | "setup" | "linking" | "manual_linking" | "ready_to_solve" | "solution" | "testing";
export type Direction = "up" | "down";
export type PlateLink = number[];
export type PlateLinks = Array<PlateLink | null>;
export type Offsets = number[];
export type LinkDeltas = Array<number | null>;

export type ManualLinkingPhase = "choose-driver" | "define-links";

export interface ManualLinkingState {
  phase: ManualLinkingPhase;
  selectedDriver: number | null;
  selectedDirection: Direction | null;
  initialOffsets: Offsets;
  offsets: Offsets;
  blockedObservations: number[];
  links: PlateLinks;
  linkDeltas: LinkDeltas;
  completedDrivers: number[];
}

export interface TestingFeedbackData {
  id: number;
  driver: number;
  delta: number;
  blockedPlates: number[];
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

export interface CountSnapshot {
  offsets: Offsets;
  links: PlateLinks;
  linkDeltas: LinkDeltas;
  linkingStartOffsets: Offsets | null;
  mode: AppMode;
}

export interface SharedLinkMetadata {
  name: string;
  description: string;
}

export interface SavedLockRecord {
  id: string;
  name: string;
  description: string;
  hasCustomName?: boolean;
  isDraft: boolean;
  savedAt: string;
  plateCount: number;
  mode: AppMode;
  linkingStartOffsets: Offsets | null;
  currentOffsets: Offsets;
  links: PlateLinks;
  linkDeltas: LinkDeltas;
}

export type ModalState =
  | { type: null }
  | { type: "save-current"; value: string; description: string }
  | { type: "rename-saved"; lockId: string }
  | { type: "delete-saved"; lockId: string }
  | { type: "delete-all-drafts" }
  | { type: "solution-steps" }
  | { type: "powershell" }
  | { type: "notation" }
  | { type: "import-locks" }
  | { type: "delete-all-saved" }
  | { type: "share"; lockId?: string }
  | { type: "start-linking-match"; lockId: string; source: "guided" | "manual" };

export interface AppStateData {
  plateCount: number;
  offsets: Offsets;
  mode: AppMode;
  solutionOrigin: "load" | null;
  solutionReturnState: AppStateData | null;
  manualLinkingReturnState: AppStateData | null;
  linkingStartOffsets: Offsets | null;
  links: PlateLinks;
  linkDeltas: LinkDeltas;
  testingFeedback: TestingFeedbackData | null;
  linkingPromptTask: PlateLinkingPromptTask | null;
  plateLinkingProcedure: PlateLinkingProcedureState | null;
  manualLinkingState: ManualLinkingState | null;
  solution: SolutionPlanData | null;
  currentSaveId: string | null;
  sharedLinkMetadata: SharedLinkMetadata | null;
  snapshotsByCount: Record<number, CountSnapshot>;
}
