import packageJson from "../../package.json";
import type {
  AppMode,
  AppStateData,
  CountSnapshot,
  LinkDeltas,
  Offsets,
  PlateLinks,
  SavedLockRecord,
} from "./types";

export const APP_VERSION = packageJson.version;
export const MIN_PLATES = 3;
export const MAX_PLATES = 7;
export const HOLE_COUNT = 7;
export const CENTER_INDEX = 3;
export const START_COUNT = 5;
export const STORAGE_KEY = "gothic-lockpick.saved-locks";

export function createEmptyLinks(count: number): PlateLinks {
  return Array.from({ length: count }, () => null);
}

export function createEmptyLinkDeltas(count: number): LinkDeltas {
  return Array.from({ length: count }, () => null);
}

export function createIdentityLink(count: number, driverIndex: number): number[] {
  return Array.from({ length: count }, (_, index) => (index === driverIndex ? 1 : 0));
}

export function cloneOffsets(offsets: Offsets): Offsets {
  return [...offsets];
}

export function resizeOffsets(offsets: Offsets | null | undefined, count: number): Offsets {
  return Array.from({ length: count }, (_, index) => offsets?.[index] ?? 0);
}

export function resizeLink(link: number[] | null | undefined, count: number): number[] | null {
  if (!link) {
    return null;
  }

  return Array.from({ length: count }, (_, index) => link[index] ?? 0);
}

export function resizeLinkDeltas(linkDeltas: LinkDeltas | null | undefined, count: number): LinkDeltas {
  return Array.from({ length: count }, (_, index) => linkDeltas?.[index] ?? null);
}

export function clampOffset(offset: number): number {
  return Math.max(-CENTER_INDEX, Math.min(CENTER_INDEX, offset));
}

export function createLockId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getUnknownPlates(links: PlateLinks): number[] {
  return links
    .map((link, index) => ({ index, known: Boolean(link) }))
    .filter(({ known }) => !known)
    .map(({ index }) => index);
}

export function createInitialAppState(): AppStateData {
  return {
    plateCount: START_COUNT,
    offsets: Array.from({ length: START_COUNT }, () => 0),
    mode: "menu",
    solutionOrigin: null,
    solutionReturnState: null,
    manualLinkingReturnState: null,
    linkingStartOffsets: null,
    links: createEmptyLinks(START_COUNT),
    linkDeltas: createEmptyLinkDeltas(START_COUNT),
    testingFeedback: null,
    linkingPromptTask: null,
    plateLinkingProcedure: null,
    manualLinkingState: null,
    solution: null,
    currentSaveId: null,
    sharedLinkMetadata: null,
    snapshotsByCount: {},
  };
}

export function createManualLinkingState(state: Pick<AppStateData, "plateCount" | "offsets" | "links" | "linkDeltas">) {
  return {
    phase: "choose-driver" as const,
    selectedDriver: null,
    selectedDirection: null,
    initialOffsets: cloneOffsets(state.offsets),
    offsets: Array.from({ length: state.plateCount }, () => 0),
    blockedObservations: Array.from({ length: state.plateCount }, () => 0),
    links: state.links.map((link) => resizeLink(link, state.plateCount)),
    linkDeltas: resizeLinkDeltas(state.linkDeltas, state.plateCount),
    completedDrivers: state.links
      .map((link, index) => (link ? index : -1))
      .filter((index) => index >= 0),
  };
}

export function isTrivialCenteredLock(state: Pick<AppStateData, "linkingStartOffsets" | "offsets" | "links" | "solution">): boolean {
  return Boolean(state.linkingStartOffsets)
    && state.linkingStartOffsets.every((offset) => offset === 0)
    && state.offsets.every((offset) => offset === 0)
    && state.links.every((link) => !link)
    && Array.isArray(state.solution?.moves)
    && state.solution.moves.length === 0;
}

export function buildSavedLockRecord(
  state: Pick<AppStateData, "plateCount" | "mode" | "linkingStartOffsets" | "offsets" | "links" | "linkDeltas">,
  { id, name, description, isDraft, hasCustomName }: { id: string; name: string; description: string; isDraft?: boolean; hasCustomName?: boolean },
): SavedLockRecord {
  return {
    id,
    name,
    description,
    hasCustomName: Boolean(hasCustomName),
    isDraft: Boolean(isDraft),
    savedAt: new Date().toISOString(),
    plateCount: state.plateCount,
    mode: state.mode,
    linkingStartOffsets: state.linkingStartOffsets ? cloneOffsets(state.linkingStartOffsets) : null,
    currentOffsets: cloneOffsets(state.offsets),
    links: state.links.map((link) => resizeLink(link, state.plateCount)),
    linkDeltas: resizeLinkDeltas(state.linkDeltas, state.plateCount),
  };
}
