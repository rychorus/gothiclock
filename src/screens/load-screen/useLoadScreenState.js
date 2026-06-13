import { deleteSavedLock, getDefaultLockName, getSavedLockById, getSavedLocks, persistCurrentLock, renameSavedLock } from "../../lib/lockStorage";
import { loadSavedLockState } from "../solution/solutionState";

export function useLoadScreenState({ appState, setAppState, setModal }) {
  function saveCurrentLock() {
    if (!appState.linkingStartOffsets && !appState.solution?.startOffsets) {
      return;
    }

    const existingLock = getSavedLockById(appState.currentSaveId);
    const fallbackName = existingLock?.isDraft
      ? existingLock.name || getDefaultLockName()
      : existingLock?.name || getDefaultLockName();
    setModal({ type: "save-current", value: fallbackName });
  }

  function persistWithName(name, isDraft = false) {
    const lockId = persistCurrentLock(appState, { isDraft, nameOverride: name });
    if (lockId) {
      setAppState((current) => ({ ...current, currentSaveId: lockId }));
    }
    setModal({ type: null });
  }

  function loadSavedLock(lockId) {
    const savedLock = getSavedLockById(lockId);
    if (!savedLock) {
      return;
    }

    setAppState((current) => loadSavedLockState(current, savedLock));
  }

  function renameLock(lockId, name) {
    renameSavedLock(lockId, name);
    setModal({ type: null });
  }

  function removeLock(lockId) {
    deleteSavedLock(lockId);
    setAppState((current) => (current.currentSaveId === lockId ? { ...current, currentSaveId: null } : current));
    setModal({ type: null });
  }

  return {
    savedLocks: getSavedLocks(),
    saveCurrentLock,
    persistWithName,
    loadSavedLock,
    renameLock,
    removeLock,
  };
}
