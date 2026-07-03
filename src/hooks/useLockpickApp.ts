import { useEffect, useRef, useState } from "react";
import { buildNotationString } from "../lib/notation";
import { APP_VERSION, createInitialAppState, getUnknownPlates, isTrivialCenteredLock } from "../lib/lockData";
import { resetTestingMode } from "../lib/appState";
import { clearSavedLockSubmissionEligibility, getSavedLockById, syncFinalLockProgress } from "../lib/lockStorage";
import { getModalAnalyticsName, getScreenAnalyticsName, trackButtonClick, trackModalView, trackScreenView, trackSettingChange } from "../lib/analytics";
import { playUiClick } from "../lib/uiClick";
import { buildShareUrl, parseShareUrl } from "../screens/shared/shareUrl";
import {
  disableDeveloperSettings as persistDeveloperSettingsDisable,
  getPersistedDeveloperSettings,
  isBackgroundSubmissionEnabled,
  setBackgroundSubmissionEnabled as persistBackgroundSubmissionEnabled,
  setPastSavesSubmissionEnabled as persistPastSavesSubmissionEnabled,
  unlockDeveloperSettings as persistDeveloperSettingsUnlock,
} from "../lib/developerSettings";
import { queueBackgroundSubmission, queueBackgroundSubmissionBatch } from "../lib/backgroundSubmission";
import {
  clearSubmittedSaveSignatures,
  getSavedLockSubmissionSignature,
  hasSavedLockBeenSubmitted,
  markSavedLockSubmitted,
  markSavedLocksSubmitted,
} from "../lib/submissionTracking";
import { useAppNavigation } from "../screens/shared/useAppNavigation";
import { useMainMenuState } from "../screens/main-menu/useMainMenuState";
import { useLoadScreenState } from "../screens/load-screen/useLoadScreenState";
import { usePlateSetupState } from "../screens/plate-setup/usePlateSetupState";
import { usePlateLinkingState } from "../screens/plate-linking/usePlateLinkingState";
import { useSolutionState } from "../screens/solution/useSolutionState";
import type { PlateLinkingPromptTask } from "../screens/plate-linking/prompt/types";
import type { AppStateData, ModalState } from "../lib/types";

const SOLUTION_NEXT_HINT_CLICK_COUNT_STORAGE_KEY = "gothic-lockpick.solution-next-hint-click-count";
const PLATE_LINKING_RESET_TOOLTIP_BLOCK_COUNT_STORAGE_KEY = "gothic-lockpick.plate-linking-reset-tooltip-block-count";
const PLATE_LINKING_RESET_TOOLTIP_MAX_TRIGGER_COUNT = 4;
const ASK_TO_SAVE_ON_SOLVE_STORAGE_KEY = "gothic-lockpick.ask-to-save-on-solve";
const SOLVED_LOCK_SIGNATURES_STORAGE_KEY = "gothic-lockpick.solved-lock-signatures";

function getCleanUrl(url: string) {
  const cleanUrl = new URL(url);
  cleanUrl.search = "";
  cleanUrl.hash = "";
  return cleanUrl.toString();
}

function getInitialAppState(): AppStateData {
  const initialState = createInitialAppState();

  if (typeof window === "undefined") {
    return initialState;
  }

  try {
    const hasVisitedBefore = window.localStorage.getItem("gothic-lockpick.has-visited-before") === "true";
    window.localStorage.setItem("gothic-lockpick.has-visited-before", "true");

    const sharedUrl = parseShareUrl(window.location.href);
    if (sharedUrl.notation) {
      return initialState;
    }

    if (!hasVisitedBefore) {
      return {
        ...initialState,
        mode: "setup",
      };
    }
  } catch {
    return {
      ...initialState,
      mode: "setup",
    };
  }

  return initialState;
}

function getPersistedSolutionNextHintClickCount() {
  if (typeof window === "undefined") {
    return 0;
  }

  try {
    const value = Number(window.localStorage.getItem(SOLUTION_NEXT_HINT_CLICK_COUNT_STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

function getPersistedPlateLinkingResetTooltipBlockCount() {
  if (typeof window === "undefined") {
    return 0;
  }

  try {
    const value = Number(window.localStorage.getItem(PLATE_LINKING_RESET_TOOLTIP_BLOCK_COUNT_STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? Math.min(Math.floor(value), PLATE_LINKING_RESET_TOOLTIP_MAX_TRIGGER_COUNT) : 0;
  } catch {
    return 0;
  }
}

function getPersistedAskToSaveOnSolve() {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    return window.localStorage.getItem(ASK_TO_SAVE_ON_SOLVE_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function getPersistedSolvedLockSignatures() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(SOLVED_LOCK_SIGNATURES_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string" && value.length > 0) : [];
  } catch {
    return [];
  }
}

function getSolvedSetupSignature(state: AppStateData) {
  const startOffsets = state.linkingStartOffsets || state.solution?.startOffsets || state.offsets;
  return buildNotationString({
    plateCount: state.plateCount,
    offsets: startOffsets,
    links: Array.from({ length: state.plateCount }, () => null),
  });
}

function hasBlockedEdgeAttempt(task: PlateLinkingPromptTask | null) {
  return Boolean(
    task
    && task.phase === "observe"
    && task.blockedObservationCounts.some((count) => count > 0),
  );
}

function isSavedLockEligibleForSubmission(savedLock: {
  submissionEligible?: boolean;
  isDraft: boolean;
  mode: AppStateData["mode"];
  linkingStartOffsets: AppStateData["linkingStartOffsets"];
}) {
  if (typeof savedLock.submissionEligible === "boolean") {
    return savedLock.submissionEligible;
  }

  // Legacy saves created before explicit eligibility tracking fall back to
  // "solved save" semantics so existing real solutions, including solved drafts,
  // can still batch submit. Imported/incomplete drafts stay blocked because they
  // do not persist in solution mode.
  return savedLock.mode === "solution"
    && Boolean(savedLock.linkingStartOffsets);
}

export function useLockpickApp() {
  const [appState, setAppState] = useState<AppStateData>(getInitialAppState);
  const [modal, setModalState] = useState<ModalState>({ type: null });
  const appliedSharedNotationRef = useRef(false);
  const suppressDraftAutosaveRef = useRef(false);
  const suppressSavedLockChangeSubmissionRef = useRef(false);
  const savedLockSubmissionSignaturesRef = useRef(new Map());
  const queuedSubmissionTimestampsRef = useRef(new Map());
  const initialPastSaveIdsRef = useRef<Set<string> | null>(null);
  const didSubmitPastSavesRef = useRef(false);
  const didSeedSavedLockSubmissionSignaturesRef = useRef(false);
  const currentScreenRef = useRef(getScreenAnalyticsName(appState.mode));
  const currentModalRef = useRef(getModalAnalyticsName(modal));
  const previousAppStateRef = useRef(appState);
  const [developerSettings, setDeveloperSettings] = useState(getPersistedDeveloperSettings);
  const [solutionNextHintClickCount, setSolutionNextHintClickCount] = useState(getPersistedSolutionNextHintClickCount);
  const [plateLinkingResetTooltipBlockCount, setPlateLinkingResetTooltipBlockCount] = useState(getPersistedPlateLinkingResetTooltipBlockCount);
  const [plateLinkingResetTooltipDismissedCount, setPlateLinkingResetTooltipDismissedCount] = useState(0);
  const [askToSaveOnSolve, setAskToSaveOnSolve] = useState(getPersistedAskToSaveOnSolve);
  const [solvedLockSignatures, setSolvedLockSignatures] = useState(getPersistedSolvedLockSignatures);

  const navigation = useAppNavigation({ appState, modal, setAppState, setModalState });
  const mainMenu = useMainMenuState({
    appState,
    setAppState,
    openLoadScreen: () => setAppState((current) => ({
      ...current,
      mode: "load",
      linkingPromptTask: null,
      plateLinkingProcedure: null,
      solutionReturnState: null,
      sharedLinkMetadata: null,
    })),
    openImportScreen: () => setAppState((current) => ({
      ...current,
      mode: "import",
      linkingPromptTask: null,
      plateLinkingProcedure: null,
      solutionReturnState: null,
      sharedLinkMetadata: null,
    })),
  });
  function submitSavedLockIfEnabled(savedLock, currentSolution) {
    const signature = getSavedLockSubmissionSignature(savedLock);
    savedLockSubmissionSignaturesRef.current.set(savedLock.id, signature);

    if (!isSavedLockEligibleForSubmission(savedLock)) {
      return;
    }

    if (!isBackgroundSubmissionEnabled(developerSettings)) {
      return;
    }

    const now = Date.now();
    queuedSubmissionTimestampsRef.current.forEach((timestamp, queuedSignature) => {
      if (now - timestamp >= 15000) {
        queuedSubmissionTimestampsRef.current.delete(queuedSignature);
      }
    });
    const queuedAt = queuedSubmissionTimestampsRef.current.get(signature);
    if (typeof queuedAt === "number" && now - queuedAt < 15000) {
      return;
    }

    if (hasSavedLockBeenSubmitted(savedLock)) {
      return;
    }

    const didDispatch = queueBackgroundSubmission({
      appVersion: APP_VERSION,
      savedLock,
      solution: currentSolution,
    });
    if (!didDispatch) {
      return;
    }

    queuedSubmissionTimestampsRef.current.set(signature, now);
    markSavedLockSubmitted(savedLock);
  }

  function submitAllPastSavedSolutions() {
    const initialPastSaveIds = initialPastSaveIdsRef.current;
    if (!initialPastSaveIds || !initialPastSaveIds.size) {
      return true;
    }

    const unsentSavedLocks = savedLocks.filter((savedLock) => (
      initialPastSaveIds.has(savedLock.id)
      && isSavedLockEligibleForSubmission(savedLock)
      && !hasSavedLockBeenSubmitted(savedLock)
    ));
    if (!unsentSavedLocks.length) {
      return true;
    }

    const didDispatch = queueBackgroundSubmissionBatch({
      appVersion: APP_VERSION,
      savedLocks: unsentSavedLocks,
    });
    if (!didDispatch) {
      return false;
    }

    markSavedLocksSubmitted(unsentSavedLocks);
    unsentSavedLocks.forEach((savedLock) => {
      savedLockSubmissionSignaturesRef.current.set(savedLock.id, getSavedLockSubmissionSignature(savedLock));
    });
    return true;
  }

  function setPastSavesSubmissionEnabled(enabled: boolean) {
    setDeveloperSettings((current) => persistPastSavesSubmissionEnabled(current, enabled));
    if (!enabled) {
      didSubmitPastSavesRef.current = false;
    }
  }

  function markCurrentSavesSubmitted() {
    markSavedLocksSubmitted(savedLocks);
    savedLocks.forEach((savedLock) => {
      savedLockSubmissionSignaturesRef.current.set(savedLock.id, getSavedLockSubmissionSignature(savedLock));
    });
    didSubmitPastSavesRef.current = false;
  }

  function markCurrentSavesNotSubmitted() {
    clearSubmittedSaveSignatures();
    didSubmitPastSavesRef.current = false;
  }

  function clearCurrentSaveSubmissionMetadata() {
    suppressSavedLockChangeSubmissionRef.current = true;
    clearSavedLockSubmissionEligibility();
    clearSubmittedSaveSignatures();
    didSubmitPastSavesRef.current = false;
  }

  const loadScreen = useLoadScreenState({
    appState,
    setAppState,
    setModal: navigation.setModal,
    onDeveloperUnlock: () => {
      setDeveloperSettings((current) => persistDeveloperSettingsUnlock(current));
      navigation.setModal({ type: null });
    },
    onSavedLockPersisted: submitSavedLockIfEnabled,
  });
  const savedLocks = loadScreen.savedLocks;
  const plateSetup = usePlateSetupState({ appState, setAppState, setModal: navigation.setModal });
  const plateLinking = usePlateLinkingState({
    appState,
    setAppState,
    onPlateLinkingInteraction: () => {
      setPlateLinkingResetTooltipDismissedCount((currentDismissedCount) => {
        if (currentDismissedCount === plateLinkingResetTooltipBlockCount) {
          return currentDismissedCount;
        }

        return plateLinkingResetTooltipBlockCount;
      });
    },
  });
  const solution = useSolutionState({ appState, setAppState });

  useEffect(() => {
    if (appliedSharedNotationRef.current || typeof window === "undefined") {
      return;
    }

    appliedSharedNotationRef.current = true;
    const sharedUrl = parseShareUrl(window.location.href);
    if (!sharedUrl.notation) {
      return;
    }

    suppressDraftAutosaveRef.current = true;

    try {
      window.history.replaceState(window.history.state, "", getCleanUrl(window.location.href));
      mainMenu.importNotation(sharedUrl.notation, {
        showSolution: true,
        sharedLinkMetadata: {
          name: sharedUrl.name,
          description: sharedUrl.description,
        },
      });
    } catch {
      // Ignore malformed shared URLs and fall back to the normal initial screen.
    }
  }, [mainMenu]);

  useEffect(() => {
    if (appState.sharedLinkMetadata) {
      suppressDraftAutosaveRef.current = true;
    } else if (appState.mode === "menu") {
      suppressDraftAutosaveRef.current = false;
    }

    if (suppressDraftAutosaveRef.current) {
      return;
    }

    const autoSavedLockId = syncFinalLockProgress(appState);
    if (autoSavedLockId) {
      const autoSavedLock = getSavedLockById(autoSavedLockId);
      if (autoSavedLock) {
        submitSavedLockIfEnabled(autoSavedLock, appState.solution);
      }
      setAppState((current) => {
        if (
          current.currentSaveId === autoSavedLockId
          && current.solutionReturnState?.currentSaveId === autoSavedLockId
        ) {
          return current;
        }

        return {
          ...current,
          currentSaveId: autoSavedLockId,
          solutionReturnState: current.solutionReturnState
            ? {
                ...current.solutionReturnState,
                currentSaveId: autoSavedLockId,
              }
            : current.solutionReturnState,
        };
      });
    }
  }, [appState, developerSettings]);

  useEffect(() => {
    const previousAppState = previousAppStateRef.current;
    const transitionedFromSolveFlow = previousAppState.mode === "linking"
      || previousAppState.mode === "manual_linking"
      || previousAppState.mode === "ready_to_solve";

    if (
      transitionedFromSolveFlow
      && appState.mode === "solution"
      && appState.solution?.moves !== null
    ) {
      const solveSignature = getSolvedSetupSignature(appState);
      const nextSolvedLockSignatures = appState.sharedLinkMetadata || solvedLockSignatures.includes(solveSignature)
        ? solvedLockSignatures
        : [...solvedLockSignatures, solveSignature];
      if (nextSolvedLockSignatures !== solvedLockSignatures) {
        setSolvedLockSignatures(nextSolvedLockSignatures);
      }

      if (
        !appState.sharedLinkMetadata
        && askToSaveOnSolve
        && (nextSolvedLockSignatures.length >= 3 || savedLocks.length >= 3)
        && modal.type === null
      ) {
        loadScreen.openSaveCurrentLockDialog("solved");
      }
    }

    previousAppStateRef.current = appState;
  }, [appState, askToSaveOnSolve, loadScreen, modal.type, solvedLockSignatures]);

  useEffect(() => {
    const currentSignatures = savedLockSubmissionSignaturesRef.current;

    if (!didSeedSavedLockSubmissionSignaturesRef.current) {
      initialPastSaveIdsRef.current = new Set(savedLocks.map((savedLock) => savedLock.id));
      savedLocks.forEach((savedLock) => {
        currentSignatures.set(savedLock.id, getSavedLockSubmissionSignature(savedLock));
      });
      didSeedSavedLockSubmissionSignaturesRef.current = true;
      return;
    }

    const activeIds = new Set();
    const shouldSuppressSavedLockChangeSubmission = suppressSavedLockChangeSubmissionRef.current;
    savedLocks.forEach((savedLock) => {
      activeIds.add(savedLock.id);
      const nextSignature = getSavedLockSubmissionSignature(savedLock);
      const previousSignature = currentSignatures.get(savedLock.id);
      if (previousSignature === nextSignature) {
        return;
      }

      currentSignatures.set(savedLock.id, nextSignature);
      if (!shouldSuppressSavedLockChangeSubmission && isBackgroundSubmissionEnabled(developerSettings)) {
        submitSavedLockIfEnabled(savedLock, null);
      }
    });

    [...currentSignatures.keys()].forEach((lockId) => {
      if (!activeIds.has(lockId)) {
        currentSignatures.delete(lockId);
      }
    });

    suppressSavedLockChangeSubmissionRef.current = false;
  }, [developerSettings, savedLocks]);

  useEffect(() => {
    if (!developerSettings.pastSavesSubmissionEnabled) {
      return;
    }

    if (didSubmitPastSavesRef.current) {
      return;
    }

    const didDispatch = submitAllPastSavedSolutions();
    didSubmitPastSavesRef.current = didDispatch;
  }, [developerSettings.pastSavesSubmissionEnabled, savedLocks]);

  useEffect(() => {
    const nextScreenName = getScreenAnalyticsName(appState.mode);
    currentScreenRef.current = nextScreenName;
    trackScreenView(nextScreenName);
  }, [appState.mode]);

  useEffect(() => {
    const nextModalName = getModalAnalyticsName(modal);
    currentModalRef.current = nextModalName;
    trackModalView(
      nextModalName,
      modal.type === "save-current" && modal.source === "solved"
        ? { ask_to_save_on_solve: askToSaveOnSolve }
        : {},
    );
  }, [modal]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(SOLUTION_NEXT_HINT_CLICK_COUNT_STORAGE_KEY, String(solutionNextHintClickCount));
    } catch {
      // Ignore storage failures and keep the hint count in memory only.
    }
  }, [solutionNextHintClickCount]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        PLATE_LINKING_RESET_TOOLTIP_BLOCK_COUNT_STORAGE_KEY,
        String(plateLinkingResetTooltipBlockCount),
      );
    } catch {
      // Ignore storage failures and keep the hint count in memory only.
    }
  }, [plateLinkingResetTooltipBlockCount]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(ASK_TO_SAVE_ON_SOLVE_STORAGE_KEY, String(askToSaveOnSolve));
    } catch {
      // Ignore storage failures and keep the preference in memory only.
    }
  }, [askToSaveOnSolve]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(SOLVED_LOCK_SIGNATURES_STORAGE_KEY, JSON.stringify(solvedLockSignatures));
    } catch {
      // Ignore storage failures and keep the solved setup history in memory only.
    }
  }, [solvedLockSignatures]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    function handleClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest("button");
      if (!button) {
        return;
      }

      const soundKind = button.getAttribute("data-sound");
      const rawLabel = button.getAttribute("aria-label")
        || button.getAttribute("data-analytics-label")
        || button.textContent
        || "Button";
      const label = rawLabel.trim().replace(/\s+/g, " ");
      if (!label) {
        return;
      }

      const suppressUiClick = button.hasAttribute("data-no-ui-click");
      if (soundKind !== "plate" && !suppressUiClick) {
        playUiClick();
      }

      if (plateLinkingResetTooltipBlockCount > 0 && plateLinkingResetTooltipBlockCount <= PLATE_LINKING_RESET_TOOLTIP_MAX_TRIGGER_COUNT) {
        setPlateLinkingResetTooltipDismissedCount((currentDismissedCount) => (
          currentDismissedCount === plateLinkingResetTooltipBlockCount
            ? currentDismissedCount
            : plateLinkingResetTooltipBlockCount
        ));
      }

      trackButtonClick({
        label,
        screen: currentScreenRef.current,
        modal: currentModalRef.current,
        context: button.getAttribute("data-analytics-context"),
      });
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [plateLinkingResetTooltipBlockCount]);

  const shouldShowPlateLinkingResetTooltip = appState.mode === "linking"
    && plateLinkingResetTooltipBlockCount >= 2
    && plateLinkingResetTooltipBlockCount <= PLATE_LINKING_RESET_TOOLTIP_MAX_TRIGGER_COUNT
    && plateLinkingResetTooltipBlockCount % 2 === 0
    && plateLinkingResetTooltipDismissedCount !== plateLinkingResetTooltipBlockCount;

  function commitPlateLinkingResetTooltipIfNeeded(task: PlateLinkingPromptTask | null) {
    if (!hasBlockedEdgeAttempt(task)) {
      return;
    }

    setPlateLinkingResetTooltipBlockCount((current) => Math.min(current + 1, PLATE_LINKING_RESET_TOOLTIP_MAX_TRIGGER_COUNT));
  }

  function dismissPlateLinkingResetTooltip() {
    if (!shouldShowPlateLinkingResetTooltip) {
      return;
    }

    setPlateLinkingResetTooltipDismissedCount(plateLinkingResetTooltipBlockCount);
  }

  const notationSource = appState.mode === "manual_linking" && appState.manualLinkingState
    ? {
        plateCount: appState.plateCount,
        offsets: appState.manualLinkingState.offsets,
        links: appState.manualLinkingState.links,
      }
    : appState;
  const notationText = buildNotationString(notationSource);
  const currentSavedLock = savedLocks.find((lock) => lock.id === appState.currentSaveId) || null;
  const hasSolvedLockSavePromptThreshold = solvedLockSignatures.length >= 3
    || savedLocks.length >= 3;

  function updateAskToSaveOnSolve(enabled: boolean) {
    setAskToSaveOnSolve(enabled);
    trackSettingChange({
      setting: "ask_to_save_on_solve",
      value: enabled,
      screen: currentScreenRef.current,
      modal: currentModalRef.current,
    });
  }

  return {
    appState,
    modal,
    developerSettings,
    savedLocks: loadScreen.savedLocks,
    unknownPlates: getUnknownPlates(appState.links),
    currentSolutionChunk: solution.currentSolutionChunk,
    testingFeedback: appState.testingFeedback,
    powershellCode: solution.powershellCode,
    notationText,
    shareUrl: buildShareUrl(
      typeof window !== "undefined" ? window.location.href : "",
      notationText,
      currentSavedLock
        ? {
            name: currentSavedLock.hasCustomName ? currentSavedLock.name : undefined,
            description: currentSavedLock.description,
            compactState: {
              plateCount: currentSavedLock.plateCount,
              offsets: currentSavedLock.currentOffsets,
              links: currentSavedLock.links,
            },
          }
        : {
            ...(appState.sharedLinkMetadata || {}),
            compactState: notationSource,
          },
    ),
    currentSavedLock,
    wasdSequence: solution.wasdSequence,
    closeModal: navigation.closeModal,
    openLoadLockDialog: mainMenu.openLoadLockDialog,
    openImportNotationDialog: mainMenu.openImportNotationDialog,
    importNotation: mainMenu.importNotation,
    saveCurrentLock: loadScreen.saveCurrentLock,
    askToSaveOnSolve,
    setAskToSaveOnSolve: updateAskToSaveOnSolve,
    showAskToSaveOnSolveSetting: hasSolvedLockSavePromptThreshold,
    loadSavedLock: loadScreen.loadSavedLock,
    renameLock: loadScreen.renameLock,
    removeLock: loadScreen.removeLock,
    removeAllDrafts: loadScreen.removeAllDrafts,
    removeAllSavedLocks: loadScreen.removeAllSavedLocks,
    exportAllSavedLocks: loadScreen.exportAllSavedLocks,
    importLocks: loadScreen.importLocks,
    persistWithName: loadScreen.persistWithName,
    submitAllPastSavedSolutions,
    markCurrentSavesSubmitted,
    markCurrentSavesNotSubmitted,
    clearCurrentSaveSubmissionMetadata,
    disableDeveloperSettings: () => setDeveloperSettings(persistDeveloperSettingsDisable()),
    setBackgroundSubmissionEnabled: (enabled) => setDeveloperSettings((current) => persistBackgroundSubmissionEnabled(current, enabled)),
    setPastSavesSubmissionEnabled,
    solutionNextHintClickCount,
    incrementSolutionNextHintClickCount: () => setSolutionNextHintClickCount((current) => current + 1),
    plateLinkingResetTooltipBlockCount,
    shouldShowPlateLinkingResetTooltip,
    commitPlateLinkingResetTooltipIfNeeded,
    dismissPlateLinkingResetTooltip,
    setAppState,
    setModal: navigation.setModal,
    goBackScreen: navigation.goBackScreen,
    goBackHeader: navigation.goBackHeader,
    actions: {
      startNewLock: plateSetup.startNewLock,
      setPlateCount: plateSetup.setPlateCount,
      startOver: plateSetup.startOver,
      startLinkingMode: plateSetup.startLinkingMode,
      startSetupManualLinkingMode: plateSetup.startSetupManualLinkingMode,
      continueSetupManualLinkingMode: plateSetup.continueSetupManualLinkingMode,
      continueLinkingMode: plateSetup.continueLinkingMode,
      startManualLinkingMode: plateLinking.startManualLinkingMode,
      selectManualDriver: plateLinking.selectManualDriver,
      nextManualLinkingStep: plateLinking.nextManualLinkingStep,
      cancelManualLinkingSelection: plateLinking.cancelManualLinkingSelection,
      solveManualLinking: plateLinking.solveManualLinking,
      resetManualLinking: plateLinking.resetManualLinking,
      stepBackPlateLinkingPrompt: plateLinking.stepBackPlateLinkingPrompt,
      resetPlateLinkingPrompt: plateLinking.resetPlateLinkingPrompt,
      advancePlateLinkingPrompt: plateLinking.advancePlateLinkingPrompt,
      completePlateLinkingPrompt: plateLinking.completePlateLinkingPrompt,
      enterSolutionMode: solution.enterSolutionMode,
      enterTestingMode: solution.enterTestingMode,
      returnToSolutionView: solution.returnToSolutionView,
      returnToLinking: navigation.goBackScreen,
      setSolutionStep: solution.setSolutionStep,
      resetTestingMode: () => setAppState(resetTestingMode),
      goToMainMenu: solution.goToMainMenu,
      goBackHeader: navigation.goBackHeader,
      goBackScreen: navigation.goBackScreen,
      goBack: navigation.goBackScreen,
      movePlate: plateLinking.movePlate,
      commitDrag: plateLinking.commitDrag,
    },
    selectors: {
      ...plateLinking.selectors,
      isTrivialCenteredLock: () => isTrivialCenteredLock(appState),
    },
  };
}
