import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { createInitialAppState, createEmptyLinkDeltas, createEmptyLinks, cloneOffsets } from "../../lib/lockData";
import { returnToSolutionView } from "../../lib/appState";
import { startFreshPlateLinkingProcedure, startPlateLinkingProcedure } from "../plate-linking/procedure/plateLinkingProcedure";
import type { AppStateData, ModalState } from "../../lib/types";

type NavigationSnapshot = {
  appState: AppStateData;
  modal: ModalState;
};

function createSnapshotId(counter: number) {
  return `nav-${counter}`;
}

function getNavigationKey(nextAppState: AppStateData, nextModal: ModalState) {
  return `${nextAppState.mode}|${nextModal.type || "none"}`;
}

function getNavigationUrl(shouldClearQuery: boolean) {
  if (typeof window === "undefined") {
    return "";
  }

  const url = new URL(window.location.href);
  if (shouldClearQuery) {
    url.search = "";
    url.hash = "";
  }

  return url.toString();
}

function getSolutionBackState(appState: AppStateData): AppStateData | null {
  if (appState.sharedLinkMetadata) {
    return createInitialAppState();
  }

  if (appState.solutionReturnState) {
    return {
      ...appState.solutionReturnState,
      solutionOrigin: null,
      solutionReturnState: null,
    };
  }

  if (appState.solutionOrigin === "load") {
    return {
      ...appState,
      mode: "setup",
      linkingPromptTask: null,
      plateLinkingProcedure: null,
      solution: null,
      solutionOrigin: null,
      solutionReturnState: null,
      sharedLinkMetadata: null,
    };
  }

  return null;
}

export function useAppNavigation({ appState, modal, setAppState, setModalState }: {
  appState: AppStateData;
  modal: ModalState;
  setAppState: Dispatch<SetStateAction<AppStateData>>;
  setModalState: Dispatch<SetStateAction<ModalState>>;
}) {
  const historyReadyRef = useRef(false);
  const historyKeyRef = useRef("");
  const historySnapshotIdRef = useRef("");
  const historySnapshotCounterRef = useRef(0);
  const navigationSnapshotsRef = useRef(new Map<string, NavigationSnapshot>());
  const restoringHistoryRef = useRef(false);

  function storeNavigationSnapshot(nextAppState: AppStateData, nextModal: ModalState, snapshotId: string) {
    navigationSnapshotsRef.current.set(snapshotId, {
      appState: nextAppState,
      modal: nextModal,
    });
  }

  function readNavigationSnapshot(snapshotId: string | undefined | null) {
    if (!snapshotId) {
      return null;
    }

    return navigationSnapshotsRef.current.get(snapshotId) || null;
  }

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
      const nextState = getSolutionBackState(appState);
      if (nextState) {
        setAppState(nextState);
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

    if (appState.mode === "manual_linking") {
      if (appState.manualLinkingReturnState) {
        setAppState({
          ...appState.manualLinkingReturnState,
          manualLinkingState: null,
          manualLinkingReturnState: null,
        });
        return;
      }

      setAppState((current) => {
        const manual = current.manualLinkingState;
        const mergedState = manual
          ? {
              ...current,
              mode: "linking" as const,
              links: manual.links.map((link) => (link ? [...link] : null)),
              linkDeltas: [...manual.linkDeltas],
              linkingPromptTask: null,
              plateLinkingProcedure: null,
              manualLinkingState: null,
              solution: null,
            }
          : {
              ...current,
              mode: "linking" as const,
              linkingPromptTask: null,
              plateLinkingProcedure: null,
              manualLinkingState: null,
              solution: null,
            };

        return startPlateLinkingProcedure(mergedState);
      });
      return;
    }

    if (appState.mode === "load" || appState.mode === "import" || appState.mode === "setup") {
      setAppState((current) => ({ ...current, mode: "menu", linkingPromptTask: null, solutionReturnState: null }));
    }
  }

  function goBackHeader() {
    if (appState.mode === "solution") {
      const nextState = getSolutionBackState(appState);
      if (nextState) {
        setAppState(nextState);
        setModalState({ type: null });
        return;
      }

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
    document.body.classList.toggle("is-manual-linking-mode", appState.mode === "manual_linking");
    document.body.classList.toggle("is-solution-mode", appState.mode === "solution" || appState.mode === "ready_to_solve" || appState.mode === "testing");
    document.body.classList.toggle("is-testing-mode", appState.mode === "testing");
  }, [appState.mode]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.history?.replaceState) {
      return undefined;
    }

    function handlePopState(event: PopStateEvent) {
      restoringHistoryRef.current = true;
      const snapshot = readNavigationSnapshot(event.state?.snapshotId);
      if (!snapshot) {
        setAppState(createInitialAppState());
        setModalState({ type: null });
        return;
      }

      historySnapshotIdRef.current = event.state?.snapshotId || historySnapshotIdRef.current;
      setAppState(snapshot.appState);
      setModalState(snapshot.modal);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setAppState, setModalState]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.history?.pushState) {
      return;
    }

    const nextKey = getNavigationKey(appState, modal);
    const nextUrl = getNavigationUrl(Boolean(appState.sharedLinkMetadata));
    const shouldCreateNewSnapshot = !historyReadyRef.current || historyKeyRef.current !== nextKey || !historySnapshotIdRef.current;
    const snapshotId = shouldCreateNewSnapshot
      ? createSnapshotId(++historySnapshotCounterRef.current)
      : historySnapshotIdRef.current;
    historySnapshotIdRef.current = snapshotId;
    storeNavigationSnapshot(appState, modal, snapshotId);
    const historyState = { snapshotId };

    if (!historyReadyRef.current) {
      window.history.replaceState(historyState, "", nextUrl);
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
      window.history.pushState(historyState, "", nextUrl);
      historyKeyRef.current = nextKey;
      return;
    }

    window.history.replaceState(historyState, "", nextUrl);
  }, [appState, modal]);

  return {
    setModal,
    closeModal,
    goBackScreen,
    goBackHeader,
  };
}
