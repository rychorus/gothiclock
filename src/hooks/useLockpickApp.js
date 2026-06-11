import { useEffect, useState } from "react";
import { buildWasdSequence, buildSolutionCommandString } from "../lib/solution";
import { canMove, getOffsetBounds, getStep2Selection, hasAnyStep2Selection } from "../lib/plateMath";
import { createInitialAppState, getUnknownPlates, isTrivialCenteredLock } from "../lib/lockData";
import { deleteSavedLock, getDefaultLockName, getSavedLockById, getSavedLocks, persistCurrentLock, renameSavedLock, syncFinalLockProgress } from "../lib/lockStorage";
import { loadSavedLockState, setPlateCount, setSolutionStep, startNewLock, startOver } from "../lib/appState";
import { advanceFromStep1, beginNextLinkTask, enterSolutionMode, finishLinkCapture, recordPlateAttempt, resetPlates, startLinkingMode, stepBackLinking, updatePlateOffset } from "../lib/linkingState";

export function useLockpickApp() {
  const [appState, setAppState] = useState(createInitialAppState);
  const [modal, setModal] = useState({ type: null });
  const [storageNonce, setStorageNonce] = useState(0);

  useEffect(() => {
    document.body.classList.toggle("is-menu-mode", appState.mode === "menu");
    document.body.classList.toggle("is-linking-mode", appState.mode === "linking");
    document.body.classList.toggle("is-solution-mode", appState.mode === "solution" || appState.mode === "ready_to_solve");
  }, [appState.mode]);

  useEffect(() => {
    if (appState.mode === "linking" || appState.mode === "ready_to_solve") {
      const lockId = persistCurrentLock(appState, { isDraft: true });
      if (lockId && lockId !== appState.currentSaveId) {
        setAppState((current) => (current.currentSaveId === lockId ? current : { ...current, currentSaveId: lockId }));
      }
    }

    syncFinalLockProgress(appState);
  }, [appState]);

  const savedLocks = getSavedLocks();
  const currentSolutionChunk = appState.mode === "solution" ? appState.solution?.chunks?.[appState.solution?.index ?? 0] || null : null;
  const unknownPlates = getUnknownPlates(appState.links);
  const powershellCode = `$myKeys = "${buildSolutionCommandString(appState.solution?.chunks)}"; $delayR = 1500; $delayAD = 500; $delayOthers = 100; Start-Sleep -Seconds 10; Add-Type -AssemblyName System.Windows.Forms; $myKeys.ToCharArray() | ForEach-Object { [System.Windows.Forms.SendKeys]::SendWait($_); if ($_ -match '^[R]$') { Start-Sleep -Milliseconds $delayR } elseif ($_ -match '^[AD]$') { Start-Sleep -Milliseconds $delayAD } else { Start-Sleep -Milliseconds $delayOthers } }`;

  function closeModal() {
    setModal({ type: null });
  }

  function persistWithName(name, isDraft = false) {
    const lockId = persistCurrentLock(appState, { isDraft, nameOverride: name });
    if (lockId) {
      setAppState((current) => ({ ...current, currentSaveId: lockId }));
      setStorageNonce((value) => value + 1);
    }
    closeModal();
  }

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

  function openLoadLockDialog() {
    setModal({ type: "load-locks" });
  }

  function loadSavedLock(lockId) {
    const savedLock = getSavedLockById(lockId);
    if (!savedLock) {
      return;
    }

    setAppState((current) => loadSavedLockState(current, savedLock));
    closeModal();
  }

  function movePlate(index, direction) {
    const delta = direction === "up" ? -1 : 1;
    const bounds = getOffsetBounds(appState, index);
    const nextOffset = appState.offsets[index] + delta;

    if (nextOffset < bounds.min || nextOffset > bounds.max) {
      setAppState((current) => recordPlateAttempt(current, index, delta));
      return;
    }

    setAppState((current) => updatePlateOffset(current, index, nextOffset, 0));
  }

  function commitDrag(index, nextOffset, attemptedDirection) {
    setAppState((current) => updatePlateOffset(current, index, nextOffset, attemptedDirection));
  }

  function renameLock(lockId, name) {
    renameSavedLock(lockId, name);
    setStorageNonce((value) => value + 1);
    closeModal();
  }

  function removeLock(lockId) {
    deleteSavedLock(lockId);
    setStorageNonce((value) => value + 1);
    setAppState((current) => (current.currentSaveId === lockId ? { ...current, currentSaveId: null } : current));
    closeModal();
  }

  return {
    appState,
    modal,
    storageNonce,
    setModal,
    savedLocks,
    unknownPlates,
    currentSolutionChunk,
    powershellCode,
    wasdSequence: buildWasdSequence(appState.solution?.chunks),
    closeModal,
    openLoadLockDialog,
    saveCurrentLock,
    loadSavedLock,
    renameLock,
    removeLock,
    persistWithName,
    setAppState,
    setModal,
    actions: {
      startNewLock: () => setAppState(startNewLock),
      setPlateCount: (count) => setAppState((current) => setPlateCount(current, count)),
      startOver: () => setAppState(startOver),
      startLinkingMode: () => setAppState(startLinkingMode),
      stepBackLinking: () => setAppState(stepBackLinking),
      resetPlates: () => setAppState(resetPlates),
      advanceFromStep1: () => setAppState(advanceFromStep1),
      finishLinkCapture: () => setAppState(finishLinkCapture),
      enterSolutionMode: () => setAppState(enterSolutionMode),
      beginNextLinkTask: () => setAppState(beginNextLinkTask),
      returnToLinking: () => setAppState((current) => beginNextLinkTask({ ...current, mode: "linking" })),
      setSolutionStep: (index) => setAppState((current) => setSolutionStep(current, index)),
      goToMainMenu: () => {
        closeModal();
        setAppState((current) => ({ ...current, mode: "menu", currentTask: null }));
      },
      movePlate,
      commitDrag,
    },
    selectors: {
      canMove: (index, direction) => canMove(appState, index, direction),
      getOffsetBounds: (index) => getOffsetBounds(appState, index),
      getStep2Selection: (index) => getStep2Selection(appState, index),
      hasAnyStep2Selection: () => hasAnyStep2Selection(appState),
      isTrivialCenteredLock: () => isTrivialCenteredLock(appState),
    },
  };
}
