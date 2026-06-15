import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { createInitialAppState, createEmptyLinkDeltas, createEmptyLinks, cloneOffsets } from "../../lib/lockData";
import { returnToSolutionView } from "../../lib/appState";
import { startFreshPlateLinkingProcedure, startPlateLinkingProcedure } from "../plate-linking/procedure/plateLinkingProcedure";
import type { AppStateData, ModalState } from "../../lib/types";

function snapshotNavigation(nextAppState: AppStateData, nextModal: ModalState) {
  return { appState: nextAppState, modal: nextModal };
}

function getNavigationKey(nextAppState: AppStateData, nextModal: ModalState) {
  return `${nextAppState.mode}|${nextModal.type || "none"}`;
}

export function useAppNavigation({ appState, modal, setAppState, setModalState }: {
  appState: AppStateData;
  modal: ModalState;
  setAppState: Dispatch<SetStateAction<AppStateData>>;
  setModalState: Dispatch<SetStateAction<ModalState>>;
}) {
  const historyReadyRef = useRef(false);
  const historyKeyRef = useRef("");
  const restoringHistoryRef = useRef(false);

  function setModal(nextModal: ModalState) {
    setModalState(nextModal);
  }

  function closeModal() {
    if (typeof window !== "undefined" && window.history?.length > 1) {
      window.history.back();
      return;
    }

    setModalState({ type: null });
  }

  function goBackScreen() {
    if (modal.type) {
      setModalState({ type: null });
      return;
    }

    if (appState.mode === "testing") {
      setAppState(returnToSolutionView);
      return;
    }

    if (appState.mode === "solution") {
      if (appState.solutionReturnState) {
        setAppState({
          ...appState.solutionReturnState,
          solutionOrigin: null,
          solutionReturnState: null,
        });
        return;
      }

      setAppState((current) => startFreshPlateLinkingProcedure({
        ...current,
        mode: "linking",
        linkingPromptTask: null,
        plateLinkingProcedure: null,
        solution: null,
        solutionReturnState: null,
      }));
      return;
    }

    if (appState.mode === "ready_to_solve") {
      setAppState((current) => startFreshPlateLinkingProcedure({ ...current, mode: "linking" }));
      return;
    }

    if (appState.mode === "linking") {
      setAppState((current) => ({
        ...current,
        mode: "setup",
        offsets: cloneOffsets(current.linkingStartOffsets || current.offsets),
        linkingStartOffsets: null,
        links: createEmptyLinks(current.plateCount),
        linkDeltas: createEmptyLinkDeltas(current.plateCount),
        linkingPromptTask: null,
        plateLinkingProcedure: null,
        solution: null,
        solutionReturnState: null,
      }));
      return;
    }

    if (appState.mode === "load" || appState.mode === "import" || appState.mode === "setup") {
      setAppState((current) => ({ ...current, mode: "menu", linkingPromptTask: null, solutionReturnState: null }));
    }
  }

  function goBackHeader() {
    if (appState.mode === "solution" && appState.solutionOrigin === "load") {
      setAppState(createInitialAppState());
      setModalState({ type: null });
      return;
    }

    goBackScreen();
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

      function handlePopState(event: PopStateEvent) {
      restoringHistoryRef.current = true;
      setAppState(event.state?.appState || createInitialAppState());
      setModalState(event.state?.modal || { type: null });
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setAppState, setModalState]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.history?.pushState) {
      return;
    }

    const nextKey = getNavigationKey(appState, modal);

    if (!historyReadyRef.current) {
      window.history.replaceState(snapshotNavigation(appState, modal), "", window.location.href);
      historyKeyRef.current = nextKey;
      historyReadyRef.current = true;
      return;
    }

    if (restoringHistoryRef.current) {
      restoringHistoryRef.current = false;
      historyKeyRef.current = nextKey;
      return;
    }

    if (historyKeyRef.current !== nextKey) {
      window.history.pushState(snapshotNavigation(appState, modal), "", window.location.href);
      historyKeyRef.current = nextKey;
      return;
    }

    window.history.replaceState(snapshotNavigation(appState, modal), "", window.location.href);
  }, [appState, modal]);

  return {
    setModal,
    closeModal,
    goBackScreen,
    goBackHeader,
  };
}
