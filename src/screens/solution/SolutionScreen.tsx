import { MaterialIcon } from "../../lib/icons";
import { playPlateClick } from "../../lib/plateClick";
import { formatSolutionStepInstruction } from "../../lib/solution";
import { LockStage } from "../shared/LockStage";
import { SolutionSequence } from "./SolutionSequence";

export function SolutionScreen({ app, appState, currentSolutionChunk, testingFeedback, selectors, actions }) {
  const solutionChunks = appState.solution?.chunks ?? [];
  const currentStep = Math.min((appState.solution?.index ?? 0) + 1, solutionChunks.length || 1);
  const moves = appState.solution?.moves;
  const hasSolution = moves !== null;
  const isResetStep = currentSolutionChunk?.type === "reset";
  const shouldShowNextHint = isResetStep && (appState.solution?.index ?? 0) === 0 && (app.solutionNextHintClickCount ?? 0) < 3;

  return (
    <>
      <LockStage
        app={app}
        appState={appState}
        currentSolutionChunk={currentSolutionChunk}
        testingFeedback={testingFeedback}
        selectors={selectors}
        actions={actions}
        showResetButton
      />

      {!hasSolution ? (
        <section className="bottom-panel solution-empty-panel">
          <div className="solution-empty-message" aria-live="polite">
            <p className="solution-empty-title">No solution</p>
            <p className="solution-empty-copy">was found for this lock</p>
          </div>
        </section>
      ) : appState.mode !== "testing" ? (
        <section className="bottom-panel">
          <div className="controls-heading bottom-panel-heading">
            <div className="solution-step-header">
              <div className="solution-progress-nav" aria-label="Solution step navigation">
                <button className="solution-nav-button" type="button" aria-label="Previous solution step" data-sound="plate" disabled={(appState.solution?.index ?? 0) <= 0} onClick={() => {
                  playPlateClick();
                  actions.setSolutionStep((appState.solution?.index ?? 0) - 1);
                }}>
                  <MaterialIcon name="chevron_left" />
                </button>
                <p className="controls-title is-solution">{currentStep} of {solutionChunks.length || 1}</p>
                <div className="solution-next-wrap">
                  {shouldShowNextHint ? <div className="solution-next-tooltip">Press to show next step</div> : null}
                  <button
                    className={`solution-nav-button${shouldShowNextHint ? " is-next-emphasized" : ""}`}
                    type="button"
                    aria-label="Next solution step"
                    data-sound="plate"
                    disabled={(appState.solution?.index ?? 0) >= solutionChunks.length - 1}
                    onClick={() => {
                      playPlateClick();
                      if (shouldShowNextHint) {
                        app.incrementSolutionNextHintClickCount();
                      }
                      actions.setSolutionStep((appState.solution?.index ?? 0) + 1);
                    }}
                  >
                    <MaterialIcon name="chevron_right" />
                  </button>
                </div>
              </div>
              <p className="solution-step-instruction">
                {formatSolutionStepInstruction(currentSolutionChunk, appState.plateCount)}
              </p>
            </div>
            <div className="solution-menu-wrap">
              <button
                className="solution-toggle-icon"
                type="button"
                aria-label="Open Auto-type the solution dialog"
                onClick={() => app.setModal({ type: "powershell" })}
              >
                <svg viewBox="0 -960 960 960" focusable="false" aria-hidden="true">
                  <path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H160v400Zm140-40-56-56 103-104-104-104 57-56 160 160-160 160Zm180 0v-80h240v80H480Z" />
                </svg>
              </button>
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
