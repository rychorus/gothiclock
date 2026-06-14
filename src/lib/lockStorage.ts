import { STORAGE_KEY, buildSavedLockRecord, cloneOffsets, createLockId, isTrivialCenteredLock } from "./lockData";

function getStorage() {
  return window.localStorage;
}

export function getSavedLocks() {
  try {
    return JSON.parse(getStorage().getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function setSavedLocks(locks) {
  getStorage().setItem(STORAGE_KEY, JSON.stringify(locks));
}

export function getSavedLockById(lockId) {
  if (!lockId) {
    return null;
  }

  return getSavedLocks().find((lock) => lock.id === lockId) || null;
}

export function upsertSavedLock(lockRecord) {
  const savedLocks = getSavedLocks();
  const nextLocks = savedLocks.filter((lock) => lock.id !== lockRecord.id);
  nextLocks.unshift(lockRecord);
  setSavedLocks(nextLocks);
}

export function getDefaultLockName() {
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

export function persistCurrentLock(
  state,
  { isDraft, nameOverride }: { isDraft?: boolean; nameOverride?: string } = {},
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
  const lockId = normalizedState.currentSaveId || createLockId();

  upsertSavedLock(buildSavedLockRecord(normalizedState, { id: lockId, name, isDraft }));
  return lockId;
}

export function renameSavedLock(lockId, nextName) {
  const trimmedName = nextName.trim();
  if (!trimmedName) {
    return;
  }

  const nextLocks = getSavedLocks().map((lock) => {
    if (lock.id !== lockId) {
      return lock;
    }

    return {
      ...lock,
      name: trimmedName,
      isDraft: false,
      savedAt: new Date().toISOString(),
    };
  });

  setSavedLocks(nextLocks);
}

export function deleteSavedLock(lockId) {
  setSavedLocks(getSavedLocks().filter((lock) => lock.id !== lockId));
}

export function syncFinalLockProgress(state) {
  if ((state.mode !== "solution" && state.mode !== "ready_to_solve") || isTrivialCenteredLock(state)) {
    return;
  }

  persistCurrentLock(state, { isDraft: true });
}
