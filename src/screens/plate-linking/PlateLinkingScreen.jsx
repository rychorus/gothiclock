import { LockStage } from "../shared/LockStage";

export function PlateLinkingScreen({ appState, currentSolutionChunk, testingFeedback, selectors, actions }) {
  const noOtherPlateMoved = appState.currentTask?.phase === "step2" && !selectors.hasAnyStep2Selection();
  const isAtLinkingStart = !appState.links.some(Boolean) && appState.currentTask?.phase === "step1";

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

      <div className="footer-actions" hidden={false} data-mode={appState.mode} data-count="2">
        <button className="action-button secondary" type="button" onClick={actions.stepBackLinking}>
          <span className="action-button-row"><span className="action-icon is-left" aria-hidden="true"></span><span>{isAtLinkingStart ? "Back to setup" : "Back"}</span></span>
        </button>
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
      </div>
    </>
  );
}
