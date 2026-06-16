import { MAX_PLATES, MIN_PLATES } from "../../lib/lockData";
import { LockStage } from "../shared/LockStage";

export function PlateSetupScreen({ appState, currentSolutionChunk, testingFeedback, selectors, actions }) {
  const moves = appState.solution?.moves;
  const showStatusCard = (moves === null || moves?.length === 0) && appState.mode !== "linking" && appState.mode !== "ready_to_solve" && appState.mode !== "testing";

  return (
    <>
      <section className="controls-card" aria-live="polite">
        <div className="controls-heading"><p className="controls-title">Plate count</p></div>
        <div className="count-picker">
          {Array.from({ length: MAX_PLATES - MIN_PLATES + 1 }, (_, offset) => {
            const count = MIN_PLATES + offset;
            return <button key={count} type="button" className={`count-button${count === appState.plateCount ? " is-active" : ""}`} onClick={() => actions.setPlateCount(count)}>{count}</button>;
          })}
        </div>
      </section>

      {showStatusCard ? (
        <section className="controls-card" aria-live="polite">
          <p className="controls-copy">{moves === null ? "No solution found" : "The saved setup is already aligned at the center."}</p>
        </section>
      ) : null}

      <LockStage
        appState={appState}
        currentSolutionChunk={currentSolutionChunk}
        testingFeedback={testingFeedback}
        selectors={selectors}
        actions={actions}
        instruction="Arrange the plates as shown on the lock"
        instructionClassName="is-setup-mode"
      />

      <div className="footer-actions" hidden={false} data-mode={appState.mode} data-count="1">
        <button className="action-button primary" type="button" disabled={appState.offsets.every((offset) => offset === 0)} onClick={actions.startLinkingMode}>Start Linking</button>
      </div>
    </>
  );
}
