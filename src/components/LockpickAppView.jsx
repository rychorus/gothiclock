import { useEffect, useMemo, useRef, useState } from "react";
import { MAX_PLATES, MIN_PLATES } from "../lib/lockData";
import { MaterialIcon } from "../lib/icons";
import { AppModal } from "./AppModal";
import { PlateColumn } from "./PlateColumn";
import { SavedLocksDialog } from "./SavedLocksDialog";
import { SolutionSequence } from "./SolutionSequence";

function renderHeroTitle(mode) {
  if (mode === "linking") {
    return "Linking Mode";
  }

  if (mode === "setup") {
    return "Plates Setup";
  }

  if (mode === "testing") {
    return "Testing Mode";
  }

  if (mode === "solution" || mode === "ready_to_solve") {
    return "Solution Mode";
  }

  if (mode === "import") {
    return "Import Notation";
  }

  if (mode === "load") {
    return "Load Lock";
  }

  return null;
}

function getStageInstruction(appState, currentSolutionChunk) {
  if (appState.mode === "linking" && appState.currentTask) {
    const driverIndex = appState.currentTask.driver ?? 0;
    const driver = (appState.plateCount - driverIndex);
    const direction = appState.currentTask.direction === "up" ? "left" : "right";
    return appState.currentTask.phase === "step2" ? `What moved with plate ${driver}?` : `Move plate ${driver} ${direction}`;
  }

  return "";
}

export function LockpickAppView({ app, appVersion }) {
  const { appState, modal, savedLocks, unknownPlates, currentSolutionChunk, testingFeedback, powershellCode, actions, selectors } = app;
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [isTopMenuOpen, setIsTopMenuOpen] = useState(false);
  const [isSolutionMenuOpen, setIsSolutionMenuOpen] = useState(false);
  const topMenuRef = useRef(null);
  const solutionMenuRef = useRef(null);
  const heroTitle = renderHeroTitle(appState.mode);
  const stageInstruction = getStageInstruction(appState, currentSolutionChunk);
  const solutionChunks = appState.solution?.chunks ?? [];
  const currentStep = Math.min((appState.solution?.index ?? 0) + 1, solutionChunks.length || 1);
  const moves = appState.solution?.moves;
  const noOtherPlateMoved = appState.currentTask?.phase === "step2" && !selectors.hasAnyStep2Selection();
  const isAtLinkingStart = !appState.links.some(Boolean) && appState.currentTask?.phase === "step1";
  const deferredDrivers = new Set((appState.deferredLinkTasks || []).map((task) => task.driver));
  if (appState.currentTask?.wasDeferred) {
    deferredDrivers.add(appState.currentTask.driver);
  }
  useEffect(() => {
    if (appState.mode !== "import") {
      return;
    }

    setImportText("");
    setImportError("");
  }, [appState.mode]);

  const modalNode = useMemo(
    () => (
      <AppModal
        app={app}
        modal={modal}
        savedLocks={savedLocks}
        solutionChunks={solutionChunks}
        currentSolutionIndex={appState.solution?.index ?? 0}
        powershellCode={powershellCode}
      />
    ),
    [app, appState.solution?.index, modal, powershellCode, savedLocks, solutionChunks],
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
    if (!isSolutionMenuOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!solutionMenuRef.current?.contains(event.target)) {
        setIsSolutionMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isSolutionMenuOpen]);

  return (
    <>
      <main className="app-shell">
        <section className="panel">
          <header className="hero">
            <button
              className="hero-back"
              type="button"
              aria-label={appState.mode === "testing" ? "Back to solution mode" : "Back to main menu"}
              hidden={appState.mode === "menu"}
              onClick={appState.mode === "testing" ? actions.returnToSolutionView : actions.goToMainMenu}
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
            <section className="controls-card" aria-live="polite">
              <div className="menu-actions">
                <button className="action-button primary" type="button" onClick={actions.startNewLock}>New lock</button>
                <button className="action-button secondary" type="button" onClick={app.openLoadLockDialog}>Load lock</button>
                <button className="action-button secondary" type="button" onClick={app.openImportNotationDialog}>Import notation</button>
              </div>
            </section>
          ) : appState.mode === "import" ? (
            <section className="controls-card controls-card--import-screen" aria-live="polite">
              <label className="import-notation-field">
                <span className="controls-title">Paste notation</span>
                <textarea
                  className="import-notation-input"
                  value={importText}
                  onChange={(event) => {
                    setImportText(event.target.value);
                    setImportError("");
                  }}
                  placeholder={"P1=4 P2=4 P3=4\n\nP1>P2 P2>P3- P3>"}
                />
              </label>
              {importError ? <p className="modal-note import-notation-error">{importError}</p> : null}
              <div className="menu-actions import-notation-actions">
                <button className="action-button secondary" type="button" onClick={actions.goToMainMenu}>Cancel</button>
                <button
                  className="action-button primary"
                  type="button"
                  onClick={() => {
                    try {
                      app.importNotation(importText);
                      setImportError("");
                    } catch (error) {
                      setImportError(error instanceof Error ? error.message : "Could not import notation.");
                    }
                  }}
                >
                  Import
                </button>
              </div>
            </section>
          ) : appState.mode === "load" ? (
            <section className="controls-card controls-card--load-screen" aria-live="polite">
              <SavedLocksDialog
                savedLocks={savedLocks}
                onLoad={app.loadSavedLock}
                onRename={(lockId) => app.setModal({ type: "rename-saved", lockId })}
                onDelete={(lockId) => app.setModal({ type: "delete-saved", lockId })}
              />
            </section>
          ) : appState.mode === "setup" ? (
            <section className="controls-card" aria-live="polite">
              <div className="controls-heading"><p className="controls-title">Plate count</p></div>
              <div className="count-picker">
                {Array.from({ length: MAX_PLATES - MIN_PLATES + 1 }, (_, offset) => {
                  const count = MIN_PLATES + offset;
                  return <button key={count} type="button" className={`count-button${count === appState.plateCount ? " is-active" : ""}`} onClick={() => actions.setPlateCount(count)}>{count}</button>;
                })}
              </div>
            </section>
          ) : (moves === null || moves?.length === 0) && appState.mode !== "linking" && appState.mode !== "ready_to_solve" && appState.mode !== "testing" ? (
            <section className="controls-card" aria-live="polite">
              <p className="controls-copy">{moves === null ? "No solution found" : "The saved setup is already aligned at the center."}</p>
            </section>
          ) : null}

          <section className={`lock-stage${appState.mode === "solution" || appState.mode === "ready_to_solve" ? " is-solution-compact" : ""}`} hidden={appState.mode === "menu" || appState.mode === "load" || appState.mode === "import"}>
            {stageInstruction ? <div className={`stage-instruction${appState.mode === "linking" ? " is-linking-mode" : ""}`} aria-live="polite">{stageInstruction}</div> : null}
            <div className="plates-row" aria-label="Lock plates">
              {appState.offsets.map((offset, index) => (
                <PlateColumn
                  key={index}
                  index={index}
                  offset={offset}
                  mode={appState.mode}
                  currentTask={appState.currentTask}
                  currentSolutionMove={currentSolutionChunk?.move ?? null}
                  testingFeedback={testingFeedback}
                  selection={selectors.getStep2Selection(index)}
                  isKnown={Boolean(appState.links[index])}
                  isDeferred={deferredDrivers.has(index)}
                  bounds={selectors.getOffsetBounds(index)}
                  canMoveUp={selectors.canMove(index, "up")}
                  canMoveDown={selectors.canMove(index, "down")}
                  onMove={actions.movePlate}
                  onCommitDrag={actions.commitDrag}
                />
              ))}
            </div>
          </section>

          {(appState.mode === "linking" || appState.mode === "testing") ? (
            <div className="stage-inline-actions" data-mode={appState.mode}>
              <button className="stage-reset" type="button" onClick={appState.mode === "testing" ? actions.resetTestingMode : actions.resetPlates}>Reset</button>
            </div>
          ) : null}

          {(appState.mode === "ready_to_solve" || appState.mode === "solution") ? (
            <section className="bottom-panel">
              <div className="controls-heading bottom-panel-heading">
                <div className="solution-progress-nav" aria-label="Solution step navigation">
                  <button className="solution-nav-button" type="button" aria-label="Previous solution step" disabled={(appState.solution?.index ?? 0) <= 0} onClick={() => actions.setSolutionStep((appState.solution?.index ?? 0) - 1)}><MaterialIcon name="chevron_left" /></button>
                  <p className="controls-title is-solution">{currentStep} of {solutionChunks.length || 1}</p>
                  <button className="solution-nav-button" type="button" aria-label="Next solution step" disabled={(appState.solution?.index ?? 0) >= solutionChunks.length - 1} onClick={() => actions.setSolutionStep((appState.solution?.index ?? 0) + 1)}><MaterialIcon name="chevron_right" /></button>
                </div>
                <div ref={solutionMenuRef} className="solution-menu-wrap">
                  <button className="solution-toggle-icon" type="button" aria-label="Solution actions" aria-expanded={isSolutionMenuOpen} onClick={() => setIsSolutionMenuOpen((current) => !current)}><MaterialIcon name="more_vert" /></button>
                  <div className="saved-lock-menu solution-toggle-menu" hidden={!isSolutionMenuOpen}>
                    <button className="saved-lock-menu-item" type="button" onClick={() => { setIsSolutionMenuOpen(false); actions.enterTestingMode(); }}>
                      <MaterialIcon name="play_arrow" />
                      <span>Testing mode</span>
                    </button>
                    <button className="saved-lock-menu-item" type="button" onClick={() => { setIsSolutionMenuOpen(false); app.setModal({ type: "powershell" }); }}>
                      <MaterialIcon name="code" />
                      <span>Generate powershell code</span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="solution-sequence-wrap"><SolutionSequence chunks={solutionChunks} currentIndex={appState.solution?.index ?? 0} onSelect={actions.setSolutionStep} /></div>
            </section>
          ) : null}

          <div className="footer-actions" hidden={appState.mode === "menu" || appState.mode === "load" || appState.mode === "import"} data-mode={appState.mode} data-count={appState.mode === "solution" || appState.mode === "linking" || appState.mode === "ready_to_solve" ? "2" : "1"}>
            {appState.mode === "setup" ? <button className="action-button primary" type="button" disabled={appState.offsets.every((offset) => offset === 0)} onClick={actions.startLinkingMode}>Start Linking</button> : null}
            {appState.mode === "linking" ? (
              <>
                <button className="action-button secondary" type="button" onClick={actions.stepBackLinking}><span className="action-button-row"><span className="action-icon is-left" aria-hidden="true"></span><span>{isAtLinkingStart ? "Back to setup" : "Back"}</span></span></button>
                <button className="action-button primary" type="button" onClick={appState.currentTask?.phase === "step2" ? actions.finishLinkCapture : actions.advanceFromStep1}>
                  {noOtherPlateMoved ? (
                    <>
                      <span className="action-button-row"><span>Next</span></span>
                      <span className="action-button-subtitle">nothing else moved</span>
                    </>
                  ) : (
                    "Next"
                  )}
                </button>
              </>
            ) : null}
            {appState.mode === "ready_to_solve" ? (
              <>
                <button className="action-button secondary" type="button" onClick={actions.returnToLinking}>Back</button>
                <button className={`action-button ${moves === null ? "primary" : "solve"}`} type="button" disabled={moves === null} onClick={actions.enterSolutionMode}>{moves === null ? "No solution" : "Solve"}</button>
              </>
            ) : null}
            {appState.mode === "solution" ? (
              <>
                <button className="action-button secondary" type="button" onClick={actions.startOver}><span className="action-button-row"><MaterialIcon name="restart_alt" /><span>Start over</span></span></button>
                <button className="action-button primary" type="button" disabled={!solutionChunks.length} onClick={app.saveCurrentLock}><span className="action-button-row"><MaterialIcon name="save" /><span>Save as</span></span></button>
              </>
            ) : null}
            {appState.mode === "testing" ? (
              <button className="action-button primary" type="button" onClick={actions.returnToSolutionView}>Back to solution</button>
            ) : null}
          </div>
        </section>
      </main>
      {modalNode}
    </>
  );
}
