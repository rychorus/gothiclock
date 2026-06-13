import { useEffect, useMemo, useRef, useState } from "react";
import { AppModal } from "./AppModal";
import { MaterialIcon } from "../lib/icons";
import { getHeroTitle } from "../screens/shared/screenUtils";
import { MainMenuScreen } from "../screens/main-menu/MainMenuScreen";
import { ImportNotationScreen } from "../screens/main-menu/ImportNotationScreen";
import { LoadScreen } from "../screens/load-screen/LoadScreen";
import { PlateSetupScreen } from "../screens/plate-setup/PlateSetupScreen";
import { PlateLinkingScreen } from "../screens/plate-linking/PlateLinkingScreen";
import { SolutionScreen } from "../screens/solution/SolutionScreen";

export function LockpickAppView({ app, appVersion }) {
  const { appState, modal, savedLocks, currentSolutionChunk, testingFeedback, powershellCode, actions, selectors } = app;
  const [isTopMenuOpen, setIsTopMenuOpen] = useState(false);
  const topMenuRef = useRef(null);
  const heroTitle = getHeroTitle(appState.mode);

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

  return (
    <>
      <main className="app-shell">
        <section className="panel">
          <header className="hero">
            <button
              className="hero-back"
              type="button"
              aria-label={appState.mode === "testing" ? "Back to solution mode" : appState.mode === "solution" ? "Back to ready to solve" : appState.mode === "ready_to_solve" ? "Back to linking" : appState.mode === "linking" ? "Back to plates setup" : "Back to main menu"}
              hidden={appState.mode === "menu"}
              onClick={actions.goBackHeader}
            >
              <span></span>
            </button>
            <p className="hero-title">
              {heroTitle ? heroTitle : <><span className="hero-title-line">Gothic Remake</span>{" "}<span className="hero-title-line hero-title-line--accent">Lockpick Solver</span></>}
            </p>
            {appState.mode === "menu" ? (
              <span className="app-version" aria-label="App version" title={`Current version: ${appVersion}`}>{appVersion}</span>
            ) : (appState.mode === "setup" || appState.mode === "linking") ? (
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
            ) : null}
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
            />
          ) : appState.mode === "setup" ? (
            <PlateSetupScreen
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
