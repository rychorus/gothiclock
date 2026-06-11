import { STORAGE_KEY, buildSavedLockRecord, createLockId, isTrivialCenteredLock } from "./lockData";

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

export function persistCurrentLock(state, { isDraft, nameOverride } = {}) {
  if (!state.linkingStartOffsets || (!isDraft && isTrivialCenteredLock(state))) {
    return null;
  }

  const existingLock = getSavedLockById(state.currentSaveId);
  const fallbackName = isDraft
    ? existingLock?.name || `Draft - ${getDefaultLockName()}`
    : existingLock?.name?.replace(/^Draft - /, "") || getDefaultLockName();
  const name = nameOverride?.trim() || fallbackName;
  const lockId = state.currentSaveId || createLockId();

  upsertSavedLock(buildSavedLockRecord(state, { id: lockId, name, isDraft }));
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
      name: lock.isDraft ? `Draft - ${trimmedName}` : trimmedName,
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

  const existingLock = getSavedLockById(state.currentSaveId);
  if (!existingLock || existingLock.isDraft) {
    return;
  }

  persistCurrentLock(state, { isDraft: false });
}
