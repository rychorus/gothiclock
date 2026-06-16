import { useEffect, useMemo, useRef, useState } from "react";
import { MaterialIcon } from "../../lib/icons";
import { formatSolutionStepInstruction } from "../../lib/solution";
import { LockStage } from "../shared/LockStage";
import { SolutionSequence } from "./SolutionSequence";

export function SolutionScreen({ app, appState, currentSolutionChunk, testingFeedback, selectors, actions }) {
  const [isSolutionMenuOpen, setIsSolutionMenuOpen] = useState(false);
  const solutionMenuRef = useRef(null);
  const solutionChunks = appState.solution?.chunks ?? [];
  const currentStep = Math.min((appState.solution?.index ?? 0) + 1, solutionChunks.length || 1);
  const moves = appState.solution?.moves;
  const hasSolution = moves !== null;

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

  const solutionMenu = useMemo(
    () => (
      <div className="saved-lock-menu solution-toggle-menu" hidden={!isSolutionMenuOpen}>
        <button className="saved-lock-menu-item" type="button" onClick={() => { setIsSolutionMenuOpen(false); actions.enterTestingMode(); }}>
          <MaterialIcon name="play_arrow" />
          <span>Testing mode</span>
        </button>
        <button className="saved-lock-menu-item" type="button" onClick={() => { setIsSolutionMenuOpen(false); app.setModal({ type: "notation" }); }}>
          <MaterialIcon name="description" />
          <span>Show plates setup notation</span>
        </button>
        <button className="saved-lock-menu-item" type="button" onClick={() => { setIsSolutionMenuOpen(false); app.setModal({ type: "powershell" }); }}>
          <MaterialIcon name="code" />
          <span>Generate powershell code</span>
        </button>
      </div>
    ),
    [actions, app, isSolutionMenuOpen],
  );

  return (
    <>
      <LockStage
        appState={appState}
        currentSolutionChunk={currentSolutionChunk}
        testingFeedback={testingFeedback}
        selectors={selectors}
        actions={actions}
        showResetButton
      />

      {!hasSolution ? (
        <section className="bottom-panel">
          <div className="controls-heading bottom-panel-heading">
            <p className="controls-title is-solution">No solution</p>
          </div>
          <p className="controls-copy">No solution was found for this lock.</p>
        </section>
      ) : appState.mode !== "testing" ? (
        <section className="bottom-panel">
          <div className="controls-heading bottom-panel-heading">
            <div className="solution-step-header">
              <div className="solution-progress-nav" aria-label="Solution step navigation">
                <button className="solution-nav-button" type="button" aria-label="Previous solution step" disabled={(appState.solution?.index ?? 0) <= 0} onClick={() => actions.setSolutionStep((appState.solution?.index ?? 0) - 1)}>
                  <MaterialIcon name="chevron_left" />
                </button>
                <p className="controls-title is-solution">{currentStep} of {solutionChunks.length || 1}</p>
                <button className="solution-nav-button" type="button" aria-label="Next solution step" disabled={(appState.solution?.index ?? 0) >= solutionChunks.length - 1} onClick={() => actions.setSolutionStep((appState.solution?.index ?? 0) + 1)}>
                  <MaterialIcon name="chevron_right" />
                </button>
              </div>
              <p className="solution-step-instruction">
                {formatSolutionStepInstruction(currentSolutionChunk, appState.plateCount)}
              </p>
            </div>
            <div ref={solutionMenuRef} className="solution-menu-wrap">
              <button className="solution-toggle-icon" type="button" aria-label="Solution actions" aria-expanded={isSolutionMenuOpen} onClick={() => setIsSolutionMenuOpen((current) => !current)}>
                <MaterialIcon name="more_vert" />
              </button>
              {solutionMenu}
            </div>
          </div>
          <div className="solution-sequence-wrap">
            <SolutionSequence chunks={solutionChunks} currentIndex={appState.solution?.index ?? 0} onSelect={actions.setSolutionStep} />
          </div>
        </section>
      ) : null}

      <div className="footer-actions" hidden={false} data-mode={appState.mode} data-count={appState.mode === "solution" ? "3" : appState.mode === "linking" || appState.mode === "ready_to_solve" ? "2" : "1"}>
        {appState.mode === "ready_to_solve" ? (
          <>
            <button className="action-button secondary" type="button" onClick={actions.returnToLinking}>Back</button>
            <button className={`action-button ${moves === null ? "primary" : "solve"}`} type="button" disabled={moves === null} onClick={actions.enterSolutionMode}>{moves === null ? "No solution" : "Solve"}</button>
          </>
        ) : null}
        {appState.mode === "solution" ? (
          <>
            <button className="action-button secondary icon-only" type="button" aria-label="Menu" onClick={actions.goToMainMenu}><MaterialIcon name="home" /></button>
            <button className="action-button primary" type="button" disabled={!solutionChunks.length} onClick={app.saveCurrentLock}><span className="action-button-row"><MaterialIcon name="save" /><span>Save</span></span></button>
            <button className="action-button secondary icon-only" type="button" aria-label="Share solution" onClick={() => app.setModal({ type: "share", lockId: appState.currentSaveId || undefined })}><MaterialIcon name="share" /></button>
          </>
        ) : null}
        {appState.mode === "testing" ? (
          <button className="action-button primary" type="button" onClick={actions.returnToSolutionView}>Back to solution</button>
        ) : null}
      </div>
    </>
  );
}
