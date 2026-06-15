import { useEffect, useMemo, useRef, useState } from "react";
import { AppModal } from "./AppModal";
import { MaterialIcon } from "../lib/icons";
import { getHeroTitle } from "../screens/shared/screenUtils";
import { MainMenuScreen } from "../screens/main-menu/MainMenuScreen";
import { ImportNotationScreen } from "../screens/main-menu/ImportNotationScreen";
import { LoadScreen } from "../screens/load-screen/LoadScreen";
import { PlateSetupScreen } from "../screens/plate-setup/PlateSetupScreen";
import { PlateLinkingScreen } from "../screens/plate-linking/PlateLinkingScreen";
import { ManualPlateLinkingScreen } from "../screens/plate-linking/ManualPlateLinkingScreen";
import { SolutionScreen } from "../screens/solution/SolutionScreen";

const LOAD_SCREEN_SHOW_DRAFTS_STORAGE_KEY = "gothic-lockpick.load-screen.show-drafts";

function getPersistedShowDrafts() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(LOAD_SCREEN_SHOW_DRAFTS_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function LockpickAppView({ app, appVersion }) {
  const { appState, modal, savedLocks, currentSavedLock, currentSolutionChunk, testingFeedback, powershellCode, actions, selectors } = app;
  const [isTopMenuOpen, setIsTopMenuOpen] = useState(false);
  const [isLoadSearchOpen, setIsLoadSearchOpen] = useState(false);
  const [isLoadFilterOpen, setIsLoadFilterOpen] = useState(false);
  const [showDrafts, setShowDrafts] = useState(getPersistedShowDrafts);
  const [loadSearchQuery, setLoadSearchQuery] = useState("");
  const topMenuRef = useRef(null);
  const loadSearchRef = useRef(null);
  const loadFilterRef = useRef(null);
  const sharedSolutionName = appState.sharedLinkMetadata?.name;
  const heroTitle = appState.mode === "solution" && currentSavedLock && !currentSavedLock.isDraft
    ? `${currentSavedLock.name} Solution`
    : appState.mode === "solution" && sharedSolutionName
      ? `${sharedSolutionName} Solution`
      : getHeroTitle(appState.mode);
  const headerRight = (() => {
    if (appState.mode === "menu") {
      return <span className="app-version" aria-label="App version" title={`Current version: ${appVersion}`}>{appVersion}</span>;
    }

    if (appState.mode === "load") {
      return (
        <div className="hero-menu-wrap hero-menu-wrap--load">
          <button
            className="solution-toggle-icon hero-menu-toggle"
            type="button"
            aria-label="Search saved locks"
            aria-expanded={isLoadSearchOpen}
            onClick={() => setIsLoadSearchOpen((current) => !current)}
          >
            <MaterialIcon name="search" />
          </button>
          <div ref={loadFilterRef} className="hero-filter-wrap">
            <button
              className="solution-toggle-icon hero-menu-toggle"
              type="button"
              aria-label="Filter saved locks"
              aria-expanded={isLoadFilterOpen}
              onClick={() => setIsLoadFilterOpen((current) => !current)}
            >
              <MaterialIcon name="filter_alt" />
            </button>
            <div className="saved-lock-menu hero-menu" hidden={!isLoadFilterOpen}>
              <button
                className="saved-lock-menu-item saved-lock-menu-item--toggle"
                type="button"
                onClick={() => {
                  setShowDrafts((current) => !current);
                  setIsLoadFilterOpen(false);
                }}
              >
                <span className="saved-lock-menu-item-check" aria-hidden="true">
                  {showDrafts ? <MaterialIcon name="check" /> : null}
                </span>
                <span>Show drafts</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (appState.mode === "setup" || appState.mode === "linking" || appState.mode === "manual_linking") {
      return (
        <div ref={topMenuRef} className="hero-menu-wrap">
          <button className="solution-toggle-icon hero-menu-toggle" type="button" aria-label="Screen menu" aria-expanded={isTopMenuOpen} onClick={() => setIsTopMenuOpen((current) => !current)}>
            <MaterialIcon name="more_vert" />
          </button>
          <div className="saved-lock-menu hero-menu" hidden={!isTopMenuOpen}>
            <button className="saved-lock-menu-item" type="button" onClick={() => { setIsTopMenuOpen(false); app.setModal({ type: "notation" }); }}>
              <span>Show notation</span>
            </button>
          </div>
        </div>
      );
    }

    return null;
  })();

  const modalNode = useMemo(
    () => (
      <AppModal
        app={app}
        modal={modal}
        savedLocks={savedLocks}
        solutionChunks={appState.solution?.chunks ?? []}
        currentSolutionIndex={appState.solution?.index ?? 0}
        powershellCode={powershellCode}
        shareUrl={app.shareUrl}
      />
    ),
    [app, appState.solution?.index, modal, powershellCode, savedLocks],
  );

  useEffect(() => {
    if (!isTopMenuOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!topMenuRef.current?.contains(event.target)) {
        setIsTopMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isTopMenuOpen]);

  useEffect(() => {
    if (appState.mode === "load") {
      return undefined;
    }

    setIsLoadSearchOpen(false);
    setIsLoadFilterOpen(false);
    setLoadSearchQuery("");
    return undefined;
  }, [appState.mode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(LOAD_SCREEN_SHOW_DRAFTS_STORAGE_KEY, String(showDrafts));
    } catch {
      // Ignore storage failures and keep the preference in memory only.
    }
  }, [showDrafts]);

  useEffect(() => {
    if (!isLoadSearchOpen || appState.mode !== "load") {
      return undefined;
    }

    loadSearchRef.current?.focus?.();
    return undefined;
  }, [appState.mode, isLoadSearchOpen]);

  useEffect(() => {
    if (!isLoadFilterOpen || appState.mode !== "load") {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!loadFilterRef.current?.contains(event.target)) {
        setIsLoadFilterOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [appState.mode, isLoadFilterOpen]);

  return (
    <>
      <main className="app-shell">
        <section className="panel">
          <header className="hero">
            <button
              className="hero-back"
              type="button"
              aria-label={appState.mode === "testing" ? "Back to solution" : appState.mode === "solution" || appState.mode === "ready_to_solve" ? "Back to plates linking" : appState.mode === "manual_linking" ? "Back to guided mode" : appState.mode === "linking" ? "Back to plates setup" : "Back to main menu"}
              hidden={appState.mode === "menu"}
              onClick={actions.goBackHeader}
            >
              <span></span>
            </button>
          <p className="hero-title">
            {heroTitle ? heroTitle : <><span className="hero-title-line">Gothic Remake</span>{" "}<span className="hero-title-line hero-title-line--accent">Lockpick Solver</span></>}
          </p>
            {headerRight}
          </header>

          {appState.mode === "menu" ? (
            <MainMenuScreen
              onStartNewLock={actions.startNewLock}
              onOpenLoadLock={app.openLoadLockDialog}
              onOpenImportNotation={app.openImportNotationDialog}
            />
          ) : appState.mode === "import" ? (
            <ImportNotationScreen onCancel={actions.goToMainMenu} onImport={app.importNotation} />
          ) : appState.mode === "load" ? (
            <LoadScreen
              savedLocks={savedLocks}
              onLoad={app.loadSavedLock}
              onRename={(lockId) => app.setModal({ type: "rename-saved", lockId })}
              onDelete={(lockId) => app.setModal({ type: "delete-saved", lockId })}
              onShare={(lockId) => app.setModal({ type: "share", lockId })}
              onDeleteAllDrafts={() => app.setModal({ type: "delete-all-drafts" })}
              searchQuery={loadSearchQuery}
              showDrafts={showDrafts}
              onSearchQueryChange={setLoadSearchQuery}
              isSearchOpen={isLoadSearchOpen}
              onToggleSearch={() => setIsLoadSearchOpen((current) => !current)}
              searchInputRef={loadSearchRef}
            />
          ) : appState.mode === "setup" ? (
            <PlateSetupScreen
              appState={appState}
              currentSolutionChunk={currentSolutionChunk}
              testingFeedback={testingFeedback}
              selectors={selectors}
              actions={actions}
            />
          ) : appState.mode === "manual_linking" ? (
            <ManualPlateLinkingScreen
              appState={appState}
              currentSolutionChunk={currentSolutionChunk}
              testingFeedback={testingFeedback}
              selectors={selectors}
              actions={actions}
            />
          ) : appState.mode === "linking" ? (
            <PlateLinkingScreen
              appState={appState}
              currentSolutionChunk={currentSolutionChunk}
              testingFeedback={testingFeedback}
              selectors={selectors}
              actions={actions}
            />
          ) : appState.mode === "ready_to_solve" || appState.mode === "solution" || appState.mode === "testing" ? (
            <SolutionScreen
              app={app}
              appState={appState}
              currentSolutionChunk={currentSolutionChunk}
              testingFeedback={testingFeedback}
              selectors={selectors}
              actions={actions}
            />
          ) : null}
        </section>
      </main>
      {modalNode}
    </>
  );
}
