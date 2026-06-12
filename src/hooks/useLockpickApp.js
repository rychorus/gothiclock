import { useEffect, useRef, useState } from "react";
import { buildSolutionPlan, buildWasdSequence, buildSolutionCommandString } from "../lib/solution";
import { buildNotationString, parseNotationString } from "../lib/notation";
import { canMove, getOffsetBounds, getStep2Selection, hasAnyStep2Selection } from "../lib/plateMath";
import { createEmptyLinkDeltas, createEmptyLinks, createInitialAppState, getUnknownPlates, isTrivialCenteredLock, cloneOffsets } from "../lib/lockData";
import { deleteSavedLock, getDefaultLockName, getSavedLockById, getSavedLocks, persistCurrentLock, renameSavedLock, syncFinalLockProgress } from "../lib/lockStorage";
import { applyTestingMove, enterTestingMode, loadSavedLockState, resetTestingMode, returnToSolutionView, setPlateCount, setSolutionStep, startNewLock, startOver } from "../lib/appState";
import { advanceFromStep1, beginNextLinkTask, enterSolutionMode, finishLinkCapture, recordPlateAttempt, resetPlates, startLinkingMode, stepBackLinking, updatePlateOffset } from "../lib/linkingState";

export function useLockpickApp() {
  const [appState, setAppState] = useState(createInitialAppState);
  const [modal, setModalState] = useState({ type: null });
  const [storageNonce, setStorageNonce] = useState(0);
  const historyReadyRef = useRef(false);
  const historyKeyRef = useRef("");
  const restoringHistoryRef = useRef(false);
  const appliedSharedNotationRef = useRef(false);

  function snapshotNavigation(nextAppState = appState, nextModal = modal) {
    return { appState: nextAppState, modal: nextModal };
  }

  function getNavigationKey(nextAppState = appState, nextModal = modal) {
    return `${nextAppState.mode}|${nextModal.type || "none"}`;
  }

  function buildShareUrl(notationText) {
    if (typeof window === "undefined") {
      return "";
    }

    const shareUrl = new URL(window.location.href);
    shareUrl.search = "";
    shareUrl.hash = "";

    if (notationText) {
      shareUrl.searchParams.set("notation", notationText);
    }

    return shareUrl.toString();
  }

  function applyNotationText(text, { showSolution = false } = {}) {
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

    if (!hasLinks) {
      setAppState(() => baseState);
      return;
    }

    if (allLinksKnown) {
      if (showSolution) {
        setAppState(() => enterSolutionMode(baseState));
        return;
      }

      setAppState(() => ({
        ...baseState,
        mode: "ready_to_solve",
        solution: buildSolutionPlan(baseState, parsed.offsets),
      }));
      return;
    }

    setAppState(() => beginNextLinkTask({
      ...baseState,
      solution: null,
    }));
  }

  function replaceNavigationState(nextAppState = appState, nextModal = modal) {
    if (typeof window === "undefined" || !window.history?.replaceState) {
      return;
    }

    window.history.replaceState(snapshotNavigation(nextAppState, nextModal), "", window.location.href);
    historyKeyRef.current = getNavigationKey(nextAppState, nextModal);
  }

  function pushNavigationState(nextAppState = appState, nextModal = modal) {
    if (typeof window === "undefined" || !window.history?.pushState) {
      return;
    }

    window.history.pushState(snapshotNavigation(nextAppState, nextModal), "", window.location.href);
    historyKeyRef.current = getNavigationKey(nextAppState, nextModal);
  }

  function goBackScreen() {
    if (typeof window !== "undefined" && window.history?.length > 1) {
      window.history.back();
      return;
    }

    if (modal.type) {
      setModalState({ type: null });
      return;
    }

    if (appState.mode === "testing") {
      setAppState(returnToSolutionView);
      return;
    }

    if (appState.mode === "solution") {
      setAppState((current) => beginNextLinkTask({
        ...current,
        mode: "linking",
        currentTask: null,
        solution: null,
        links: createEmptyLinks(current.plateCount),
        linkDeltas: createEmptyLinkDeltas(current.plateCount),
        offsets: cloneOffsets(current.linkingStartOffsets || current.offsets),
        deferredLinkTasks: [],
        linkTaskHistory: [],
      }));
      return;
    }

    if (appState.mode === "ready_to_solve") {
      setAppState((current) => beginNextLinkTask({ ...current, mode: "linking" }));
      return;
    }

    if (appState.mode === "linking") {
      setAppState((current) => ({
        ...current,
        mode: "setup",
        currentTask: null,
      }));
      return;
    }

    if (appState.mode === "load" || appState.mode === "import" || appState.mode === "setup") {
      setAppState((current) => ({ ...current, mode: "menu", currentTask: null }));
    }
  }

  function goBackHeader() {
    if (appState.mode === "testing") {
      setAppState(returnToSolutionView);
      return;
    }

    if (appState.mode === "solution") {
      setAppState((current) => beginNextLinkTask({
        ...current,
        mode: "linking",
        currentTask: null,
        solution: null,
        links: createEmptyLinks(current.plateCount),
        linkDeltas: createEmptyLinkDeltas(current.plateCount),
        offsets: cloneOffsets(current.linkingStartOffsets || current.offsets),
        deferredLinkTasks: [],
        linkTaskHistory: [],
      }));
      return;
    }

    if (appState.mode === "ready_to_solve") {
      setAppState((current) => beginNextLinkTask({ ...current, mode: "linking" }));
      return;
    }

    if (appState.mode === "linking") {
      setAppState((current) => ({ ...current, mode: "setup", currentTask: null }));
      return;
    }

    if (appState.mode === "setup" || appState.mode === "load" || appState.mode === "import") {
      setAppState((current) => ({ ...current, mode: "menu", currentTask: null }));
    }
  }

  function setModal(nextModal) {
    setModalState(nextModal);
  }

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
    if (typeof window === "undefined" || !window.history?.replaceState) {
      return undefined;
    }

    function handlePopState(event) {
      restoringHistoryRef.current = true;
      setAppState(event.state?.appState || createInitialAppState());
      setModalState(event.state?.modal || { type: null });
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (appliedSharedNotationRef.current || typeof window === "undefined") {
      return;
    }

    appliedSharedNotationRef.current = true;
    const sharedNotation = new URL(window.location.href).searchParams.get("notation");
    if (!sharedNotation) {
      return;
    }

    try {
      applyNotationText(sharedNotation, { showSolution: true });
    } catch {
      // Ignore malformed shared URLs and fall back to the normal initial screen.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.history?.pushState) {
      return;
    }

    if (!historyReadyRef.current) {
      replaceNavigationState(appState, modal);
      historyReadyRef.current = true;
      return;
    }

    const nextKey = getNavigationKey(appState, modal);
    if (restoringHistoryRef.current) {
      restoringHistoryRef.current = false;
      historyKeyRef.current = nextKey;
      return;
    }

    if (historyKeyRef.current !== nextKey) {
      pushNavigationState(appState, modal);
      return;
    }

    replaceNavigationState(appState, modal);
  }, [appState, modal]);

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
    if (typeof window !== "undefined" && window.history?.length > 1) {
      window.history.back();
      return;
    }

    setModalState({ type: null });
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
    setAppState((current) => ({ ...current, mode: "load", currentTask: null }));
  }

  function openImportNotationDialog() {
    setAppState((current) => ({ ...current, mode: "import", currentTask: null }));
  }

  function importNotation(text) {
    applyNotationText(text);
  }

  function loadSavedLock(lockId) {
    const savedLock = getSavedLockById(lockId);
    if (!savedLock) {
      return;
    }

    setAppState((current) => loadSavedLockState(current, savedLock));
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
    shareUrl: buildShareUrl(buildNotationString(appState)),
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
    goBackScreen,
    goBackHeader,
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
      returnToSolutionView: goBackScreen,
      beginNextLinkTask: () => setAppState(beginNextLinkTask),
      returnToLinking: goBackScreen,
      setSolutionStep: (index) => setAppState((current) => setSolutionStep(current, index)),
      resetTestingMode: () => setAppState(resetTestingMode),
      goToMainMenu: () => setAppState(createInitialAppState),
      goBackHeader,
      goBackScreen,
      goBack: goBackScreen,
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
