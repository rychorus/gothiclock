import { useEffect, useState } from "react";
import { buildSolutionPlan, buildWasdSequence, buildSolutionCommandString } from "../lib/solution";
import { buildNotationString, parseNotationString } from "../lib/notation";
import { canMove, getOffsetBounds, getStep2Selection, hasAnyStep2Selection } from "../lib/plateMath";
import { createEmptyLinkDeltas, createInitialAppState, getUnknownPlates, isTrivialCenteredLock } from "../lib/lockData";
import { deleteSavedLock, getDefaultLockName, getSavedLockById, getSavedLocks, persistCurrentLock, renameSavedLock, syncFinalLockProgress } from "../lib/lockStorage";
import { applyTestingMove, enterTestingMode, loadSavedLockState, resetTestingMode, returnToSolutionView, setPlateCount, setSolutionStep, startNewLock, startOver } from "../lib/appState";
import { advanceFromStep1, beginNextLinkTask, enterSolutionMode, finishLinkCapture, recordPlateAttempt, resetPlates, startLinkingMode, stepBackLinking, updatePlateOffset } from "../lib/linkingState";

export function useLockpickApp() {
  const [appState, setAppState] = useState(createInitialAppState);
  const [modal, setModal] = useState({ type: null });
  const [storageNonce, setStorageNonce] = useState(0);

  useEffect(() => {
    document.body.classList.toggle("is-menu-mode", appState.mode === "menu");
    document.body.classList.toggle("is-load-mode", appState.mode === "load");
    document.body.classList.toggle("is-import-mode", appState.mode === "import");
    document.body.classList.toggle("is-setup-mode", appState.mode === "setup");
    document.body.classList.toggle("is-linking-mode", appState.mode === "linking");
    document.body.classList.toggle("is-solution-mode", appState.mode === "solution" || appState.mode === "ready_to_solve" || appState.mode === "testing");
    document.body.classList.toggle("is-testing-mode", appState.mode === "testing");
  }, [appState.mode]);

  useEffect(() => {
    const existingLock = getSavedLockById(appState.currentSaveId);
    const shouldSyncDraft = !existingLock || existingLock.isDraft;

    if ((appState.mode === "linking" || appState.mode === "ready_to_solve" || appState.mode === "solution") && shouldSyncDraft) {
      const lockId = persistCurrentLock(appState, { isDraft: true });
      if (lockId && lockId !== appState.currentSaveId) {
        setAppState((current) => (current.currentSaveId === lockId ? current : { ...current, currentSaveId: lockId }));
      }
    }

    if (shouldSyncDraft) {
      syncFinalLockProgress(appState);
    }
  }, [appState]);

  useEffect(() => {
    if (appState.mode !== "testing" || !appState.testingFeedback) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setAppState((current) => (
        current.mode === "testing" && current.testingFeedback?.id === appState.testingFeedback.id
          ? { ...current, testingFeedback: null }
          : current
      ));
    }, 420);

    return () => window.clearTimeout(timer);
  }, [appState.mode, appState.testingFeedback]);

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
    closeModal();
    setAppState((current) => ({ ...current, mode: "load", currentTask: null }));
  }

  function openImportNotationDialog() {
    closeModal();
    setAppState((current) => ({ ...current, mode: "import", currentTask: null }));
  }

  function importNotation(text) {
    const parsed = parseNotationString(text);
    const hasLinks = parsed.links.some(Boolean);
    const allLinksKnown = parsed.links.every(Boolean);
    const baseState = {
      ...createInitialAppState(),
      plateCount: parsed.plateCount,
      offsets: parsed.offsets,
      links: parsed.links,
      linkDeltas: createEmptyLinkDeltas(parsed.plateCount),
      linkingStartOffsets: parsed.offsets,
      currentTask: null,
      currentSaveId: null,
      snapshotsByCount: {},
      deferredLinkTasks: [],
      mode: hasLinks ? "linking" : "setup",
    };

    setAppState(() => {
      if (!hasLinks) {
        return baseState;
      }

      if (allLinksKnown) {
        return {
          ...baseState,
          mode: "ready_to_solve",
          solution: buildSolutionPlan(baseState, parsed.offsets),
        };
      }

      return beginNextLinkTask({
        ...baseState,
        solution: null,
      });
    });

    closeModal();
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

    if (appState.mode === "testing") {
      setAppState((current) => applyTestingMove(current, index, delta));
      return;
    }

    const bounds = getOffsetBounds(appState, index);
    const nextOffset = appState.offsets[index] + delta;

    if (nextOffset < bounds.min || nextOffset > bounds.max) {
      setAppState((current) => recordPlateAttempt(current, index, delta));
      return;
    }

    setAppState((current) => updatePlateOffset(current, index, nextOffset, 0));
  }

  function commitDrag(index, nextOffset, attemptedDirection) {
    if (appState.mode === "testing") {
      const delta = nextOffset - appState.offsets[index];
      if (delta !== 0) {
        setAppState((current) => applyTestingMove(current, index, Math.sign(delta)));
      }
      return;
    }

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
    testingFeedback: appState.testingFeedback,
    powershellCode,
    notationText: buildNotationString(appState),
    wasdSequence: buildWasdSequence(appState.solution?.chunks),
    closeModal,
    openLoadLockDialog,
    openImportNotationDialog,
    importNotation,
    saveCurrentLock,
    loadSavedLock,
    renameLock,
    removeLock,
    persistWithName,
    setAppState,
    setModal,
    actions: {
      startNewLock: () => setAppState(startNewLock),
      setPlateCount: (count) => {
        // briefly disable plate-track transitions to avoid visual jump
        document.body.classList.add("is-resizing");
        setAppState((current) => setPlateCount(current, count));
        // remove the class after next paint + a small delay
        requestAnimationFrame(() => setTimeout(() => document.body.classList.remove("is-resizing"), 80));
      },
      startOver: () => setAppState(startOver),
      startLinkingMode: () => setAppState(startLinkingMode),
      stepBackLinking: () => setAppState(stepBackLinking),
      resetPlates: () => setAppState(resetPlates),
      advanceFromStep1: () => setAppState(advanceFromStep1),
      finishLinkCapture: () => setAppState(finishLinkCapture),
      enterSolutionMode: () => setAppState(enterSolutionMode),
      enterTestingMode: () => setAppState(enterTestingMode),
      returnToSolutionView: () => setAppState(returnToSolutionView),
      beginNextLinkTask: () => setAppState(beginNextLinkTask),
      returnToLinking: () => setAppState((current) => beginNextLinkTask({ ...current, mode: "linking" })),
      setSolutionStep: (index) => setAppState((current) => setSolutionStep(current, index)),
      resetTestingMode: () => setAppState(resetTestingMode),
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
