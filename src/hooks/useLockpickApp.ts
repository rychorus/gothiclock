import { useEffect, useRef, useState } from "react";
import { buildNotationString } from "../lib/notation";
import { createInitialAppState, getUnknownPlates, isTrivialCenteredLock } from "../lib/lockData";
import { resetTestingMode } from "../lib/appState";
import { syncFinalLockProgress } from "../lib/lockStorage";
import { buildShareUrl, parseShareUrl } from "../screens/shared/shareUrl";
import { useAppNavigation } from "../screens/shared/useAppNavigation";
import { useMainMenuState } from "../screens/main-menu/useMainMenuState";
import { useLoadScreenState } from "../screens/load-screen/useLoadScreenState";
import { usePlateSetupState } from "../screens/plate-setup/usePlateSetupState";
import { usePlateLinkingState } from "../screens/plate-linking/usePlateLinkingState";
import { useSolutionState } from "../screens/solution/useSolutionState";
import type { AppStateData, ModalState } from "../lib/types";

export function useLockpickApp() {
  const [appState, setAppState] = useState<AppStateData>(createInitialAppState());
  const [modal, setModalState] = useState<ModalState>({ type: null });
  const appliedSharedNotationRef = useRef(false);

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
  const plateSetup = usePlateSetupState({ setAppState });
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

    try {
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
    const autoSavedLockId = syncFinalLockProgress(appState);
    if (autoSavedLockId) {
      setAppState((current) => (current.currentSaveId === autoSavedLockId ? current : { ...current, currentSaveId: autoSavedLockId }));
    }
  }, [appState]);

  const notationText = buildNotationString(appState);
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
    persistWithName: loadScreen.persistWithName,
    setAppState,
    setModal: navigation.setModal,
    goBackScreen: navigation.goBackScreen,
    goBackHeader: navigation.goBackHeader,
    actions: {
      startNewLock: plateSetup.startNewLock,
      setPlateCount: plateSetup.setPlateCount,
      startOver: plateSetup.startOver,
      startLinkingMode: plateSetup.startLinkingMode,
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
