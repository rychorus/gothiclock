import { STORAGE_KEY, buildSavedLockRecord, cloneOffsets, createLockId, isTrivialCenteredLock } from "./lockData";
import { buildNotationString } from "./notation";
import { buildShareUrl } from "../screens/shared/shareUrl";
import type { AppStateData, SavedLockRecord } from "./types";

function getStorage() {
  return window.localStorage;
}

function normalizeSavedLock(lock: Partial<SavedLockRecord>): SavedLockRecord {
  const name = lock.name || "Untitled lock";
  return {
    id: lock.id || createLockId(),
    name,
    description: lock.description || "",
    hasCustomName: typeof lock.hasCustomName === "boolean" ? lock.hasCustomName : /^((Draft - )?Lock \d+)$/.test(name) ? false : Boolean(name),
    isDraft: Boolean(lock.isDraft),
    savedAt: lock.savedAt || new Date().toISOString(),
    plateCount: lock.plateCount || 0,
    mode: lock.mode || "menu",
    linkingStartOffsets: lock.linkingStartOffsets || null,
    currentOffsets: lock.currentOffsets || [],
    links: lock.links || [],
    linkDeltas: lock.linkDeltas || [],
  };
}

export function getSavedLocks(): SavedLockRecord[] {
  try {
    return (JSON.parse(getStorage().getItem(STORAGE_KEY) || "[]") as Partial<SavedLockRecord>[]).map(normalizeSavedLock);
  } catch {
    return [];
  }
}

export function setSavedLocks(locks: SavedLockRecord[]) {
  getStorage().setItem(STORAGE_KEY, JSON.stringify(locks));
}

export function deleteAllSavedLocks() {
  setSavedLocks([]);
}

export function getSavedLockById(lockId: string | null | undefined): SavedLockRecord | null {
  if (!lockId) {
    return null;
  }

  return getSavedLocks().find((lock) => lock.id === lockId) || null;
}

export function findSavedLockMatchingSetup(state: Pick<AppStateData, "plateCount" | "offsets">, locks = getSavedLocks()): SavedLockRecord | null {
  return locks
    .filter((lock) => lock.plateCount === state.plateCount)
    .filter((lock) => lock.currentOffsets.length === state.offsets.length)
    .filter((lock) => lock.currentOffsets.every((offset, index) => offset === state.offsets[index]))
    .sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime())[0] || null;
}

export function upsertSavedLock(lockRecord: SavedLockRecord) {
  const savedLocks = getSavedLocks();
  const nextLocks = savedLocks.filter((lock) => lock.id !== lockRecord.id);
  nextLocks.unshift(lockRecord);
  setSavedLocks(nextLocks);
}

export function getDefaultLockName(): string {
  const savedLocks = getSavedLocks();
  let nextNumber = 1;

  while (savedLocks.some((lock) => lock.name === `Lock ${nextNumber}` || lock.name === `Draft - Lock ${nextNumber}`)) {
    nextNumber += 1;
  }

  return `Lock ${nextNumber}`;
}

function stripLegacyDraftPrefix(name) {
  return name?.replace(/^Draft - /, "") || "";
}

function isDefaultTemplateName(name: string) {
  return /^((Draft - )?Lock \d+)$/.test(name.trim());
}

export function persistCurrentLock(
  state: AppStateData,
  { isDraft, nameOverride, descriptionOverride }: { isDraft?: boolean; nameOverride?: string; descriptionOverride?: string } = {},
) {
  const normalizedState = state.linkingStartOffsets || !state.solution?.startOffsets
    ? state
    : { ...state, linkingStartOffsets: cloneOffsets(state.solution.startOffsets) };

  if (!normalizedState.linkingStartOffsets || (!isDraft && isTrivialCenteredLock(normalizedState))) {
    return null;
  }

  const existingLock = getSavedLockById(normalizedState.currentSaveId);
  const fallbackName = stripLegacyDraftPrefix(existingLock?.name) || getDefaultLockName();
  const name = nameOverride?.trim() || fallbackName;
  const description = descriptionOverride?.trim() || existingLock?.description || "";
  const lockId = normalizedState.currentSaveId || createLockId();
  const hasCustomName = Boolean(existingLock?.hasCustomName) || !isDefaultTemplateName(name);

  upsertSavedLock(buildSavedLockRecord(normalizedState, {
    id: lockId,
    name,
    description,
    isDraft,
    hasCustomName,
  }));
  return lockId;
}

export function buildSavedLocksExportText(locks: SavedLockRecord[], baseUrl: string) {
  return locks.map((lock) => {
    const url = buildShareUrl(
      baseUrl,
      buildNotationString({
        plateCount: lock.plateCount,
        offsets: lock.currentOffsets,
        links: lock.links,
      }),
      {
        name: lock.hasCustomName ? lock.name : undefined,
        description: lock.description,
        compactState: {
          plateCount: lock.plateCount,
          offsets: lock.currentOffsets,
          links: lock.links,
        },
      },
    );

    return [
      lock.name,
      lock.description || "",
      url,
    ].filter(Boolean).join("\n");
  }).join("\n\n");
}

export function renameSavedLock(lockId: string, nextName: string, nextDescription?: string) {
  const trimmedName = nextName.trim();
  if (!trimmedName) {
    return;
  }
  const trimmedDescription = nextDescription?.trim() || "";

  const nextLocks = getSavedLocks().map((lock) => {
    if (lock.id !== lockId) {
      return lock;
    }

    return {
      ...lock,
      name: trimmedName,
      description: trimmedDescription,
      hasCustomName: lock.hasCustomName || !isDefaultTemplateName(trimmedName),
      isDraft: false,
      savedAt: new Date().toISOString(),
    };
  });

  setSavedLocks(nextLocks);
}

export function deleteSavedLock(lockId: string) {
  setSavedLocks(getSavedLocks().filter((lock) => lock.id !== lockId));
}

export function deleteAllDraftLocks() {
  setSavedLocks(getSavedLocks().filter((lock) => !lock.isDraft));
}

export function syncFinalLockProgress(state: AppStateData) {
  if (
    state.mode !== "solution"
    || isTrivialCenteredLock(state)
    || state.currentSaveId
    || state.sharedLinkMetadata
  ) {
    return null;
  }

  return persistCurrentLock(state, { isDraft: true });
}
