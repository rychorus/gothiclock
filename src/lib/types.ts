import type {
  DeferredLinkTask,
  LinkDeltas,
  LinkTask,
  Offsets,
  PlateLinks,
  PlateLinkingStateData,
  TestingFeedbackData,
  SolverSessionData,
} from "../screens/plate-linking/model/types";

export type AppMode = "menu" | "load" | "import" | "setup" | "linking" | "ready_to_solve" | "solution" | "testing";
export type { DeferredLinkTask, LinkDeltas, LinkTask, Offsets, PlateLinks, PlateLinkingStateData, SolverSessionData, TestingFeedbackData } from "../screens/plate-linking/model/types";

export interface CountSnapshot {
  offsets: Offsets;
  links: PlateLinks;
  linkDeltas: LinkDeltas;
  linkingStartOffsets: Offsets | null;
  mode: AppMode;
}

export interface SavedLockRecord {
  id: string;
  name: string;
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
  | { type: "save-current"; value: string }
  | { type: "rename-saved"; lockId: string }
  | { type: "delete-saved"; lockId: string }
  | { type: "solution-steps" }
  | { type: "powershell" }
  | { type: "notation" }
  | { type: "share" };

export interface AppStateData extends PlateLinkingStateData {
  testingFeedback: TestingFeedbackData | null;
  currentTask: LinkTask | null;
  currentSaveId: string | null;
  snapshotsByCount: Record<number, CountSnapshot>;
  customSolverSession: SolverSessionData | null;
  plateCount: number;
  offsets: Offsets;
  links: PlateLinks;
  linkDeltas: LinkDeltas;
  linkingStartOffsets: Offsets | null;
  deferredLinkTasks: DeferredLinkTask[];
  linkTaskHistory: LinkTask[];
}
