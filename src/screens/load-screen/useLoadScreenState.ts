import { deleteSavedLock, getDefaultLockName, getSavedLockById, getSavedLocks, persistCurrentLock, renameSavedLock } from "../../lib/lockStorage";
import { loadSavedLockState } from "../solution/solutionState";
import type { AppStateData, ModalState, SavedLockRecord } from "../../lib/types";
import type { Dispatch, SetStateAction } from "react";

export function useLoadScreenState({ appState, setAppState, setModal }: {
  appState: AppStateData;
  setAppState: Dispatch<SetStateAction<AppStateData>>;
  setModal: (modal: ModalState) => void;
}) {
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

  function persistWithName(name: string, isDraft = false) {
    const lockId = persistCurrentLock(appState, { isDraft, nameOverride: name });
    if (lockId) {
      setAppState((current) => ({ ...current, currentSaveId: lockId }));
    }
    setModal({ type: null });
  }

  function loadSavedLock(lockId: string) {
    const savedLock = getSavedLockById(lockId);
    if (!savedLock) {
      return;
    }

    setAppState((current) => loadSavedLockState(current, savedLock));
  }

  function renameLock(lockId: string, name: string) {
    renameSavedLock(lockId, name);
    setModal({ type: null });
  }

  function removeLock(lockId: string) {
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
