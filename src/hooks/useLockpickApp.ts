import { useEffect, useRef, useState } from "react";
import { buildNotationString } from "../lib/notation";
import { createInitialAppState, getUnknownPlates, isTrivialCenteredLock } from "../lib/lockData";
import { resetTestingMode } from "../lib/appState";
import { syncFinalLockProgress } from "../lib/lockStorage";
import { getModalAnalyticsName, getScreenAnalyticsName, trackButtonClick, trackModalView, trackScreenView } from "../lib/analytics";
import { buildShareUrl, parseShareUrl } from "../screens/shared/shareUrl";
import { useAppNavigation } from "../screens/shared/useAppNavigation";
import { useMainMenuState } from "../screens/main-menu/useMainMenuState";
import { useLoadScreenState } from "../screens/load-screen/useLoadScreenState";
import { usePlateSetupState } from "../screens/plate-setup/usePlateSetupState";
import { usePlateLinkingState } from "../screens/plate-linking/usePlateLinkingState";
import { useSolutionState } from "../screens/solution/useSolutionState";
import type { AppStateData, ModalState } from "../lib/types";

const SOLUTION_NEXT_HINT_CLICK_COUNT_STORAGE_KEY = "gothic-lockpick.solution-next-hint-click-count";

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

export function useLockpickApp() {
  const [appState, setAppState] = useState<AppStateData>(getInitialAppState);
  const [modal, setModalState] = useState<ModalState>({ type: null });
  const appliedSharedNotationRef = useRef(false);
  const suppressDraftAutosaveRef = useRef(false);
  const currentScreenRef = useRef(getScreenAnalyticsName(appState.mode));
  const currentModalRef = useRef(getModalAnalyticsName(modal));
  const [solutionNextHintClickCount, setSolutionNextHintClickCount] = useState(getPersistedSolutionNextHintClickCount);

  const navigation = useAppNavigation({ appState, modal, setAppState, setModalState });
  const mainMenu = useMainMenuState({
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
  const loadScreen = useLoadScreenState({ appState, setAppState, setModal: navigation.setModal });
  const savedLocks = loadScreen.savedLocks;
  const plateSetup = usePlateSetupState({ appState, setAppState, setModal: navigation.setModal });
  const plateLinking = usePlateLinkingState({ appState, setAppState });
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
      setAppState((current) => (current.currentSaveId === autoSavedLockId ? current : { ...current, currentSaveId: autoSavedLockId }));
    }
  }, [appState]);

  useEffect(() => {
    const nextScreenName = getScreenAnalyticsName(appState.mode);
    currentScreenRef.current = nextScreenName;
    trackScreenView(nextScreenName);
  }, [appState.mode]);

  useEffect(() => {
    const nextModalName = getModalAnalyticsName(modal);
    currentModalRef.current = nextModalName;
    trackModalView(nextModalName);
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
      return undefined;
    }

    function handleClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest("button");
      if (!button) {
        return;
      }

      const rawLabel = button.getAttribute("aria-label")
        || button.getAttribute("data-analytics-label")
        || button.textContent
        || "Button";
      const label = rawLabel.trim().replace(/\s+/g, " ");
      if (!label) {
        return;
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
  }, []);

  const notationSource = appState.mode === "manual_linking" && appState.manualLinkingState
    ? {
        plateCount: appState.plateCount,
        offsets: appState.manualLinkingState.offsets,
        links: appState.manualLinkingState.links,
      }
    : appState;
  const notationText = buildNotationString(notationSource);
  const currentSavedLock = savedLocks.find((lock) => lock.id === appState.currentSaveId) || null;
  return {
    appState,
    modal,
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
        ? { name: currentSavedLock.name, description: currentSavedLock.description }
        : appState.sharedLinkMetadata || {},
    ),
    currentSavedLock,
    wasdSequence: solution.wasdSequence,
    closeModal: navigation.closeModal,
    openLoadLockDialog: mainMenu.openLoadLockDialog,
    openImportNotationDialog: mainMenu.openImportNotationDialog,
    importNotation: mainMenu.importNotation,
    saveCurrentLock: loadScreen.saveCurrentLock,
    loadSavedLock: loadScreen.loadSavedLock,
    renameLock: loadScreen.renameLock,
    removeLock: loadScreen.removeLock,
    removeAllDrafts: loadScreen.removeAllDrafts,
    removeAllSavedLocks: loadScreen.removeAllSavedLocks,
    exportAllSavedLocks: loadScreen.exportAllSavedLocks,
    importLocks: loadScreen.importLocks,
    persistWithName: loadScreen.persistWithName,
    solutionNextHintClickCount,
    incrementSolutionNextHintClickCount: () => setSolutionNextHintClickCount((current) => current + 1),
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
