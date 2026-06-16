import { MaterialIcon } from "../../../lib/icons";
import { LockStage } from "../../shared/LockStage";
import { getVisiblePlateLabel } from "../../../lib/notation";

export function ManualPlateLinkingScreen({ appState, currentSolutionChunk, testingFeedback, selectors, actions }) {
  const manualState = appState.manualLinkingState;
  const isPickingDriver = manualState?.phase !== "define-links";
  const selectedDriver = manualState?.selectedDriver ?? null;
  const isAllCompleted = Boolean(
    manualState
    && (manualState.links.every(Boolean) || manualState.completedDrivers.length >= appState.plateCount),
  );
  const hasDefinedLink = Boolean(
    manualState && selectedDriver !== null
      ? manualState.links[selectedDriver]?.some((value, index) => index !== selectedDriver && value !== 0)
      : false,
  );

  return (
    <>
      <LockStage
        appState={appState}
        currentSolutionChunk={currentSolutionChunk}
        testingFeedback={testingFeedback}
        selectors={selectors}
        actions={actions}
        selectionMode={isPickingDriver ? "manual-pick" : "manual-define"}
        manualDriverIndex={selectedDriver}
        onSelectPlate={actions.selectManualDriver}
        instruction={isPickingDriver ? "Move a plate to link" : `Define links for ${selectedDriver !== null ? getVisiblePlateLabel(selectedDriver, appState.plateCount) : "the selected plate"}.`}
        instructionClassName="is-manual-mode"
      />

      <div className="manual-linking-bottom-actions">
        <div className="manual-linking-reset-wrap">
          <button className="action-button secondary" type="button" onClick={actions.resetManualLinking}>
            <span className="action-button-row">
              <MaterialIcon name="restart_alt" />
              <span>Reset all</span>
            </span>
          </button>
        </div>

        <div className="footer-actions" data-mode="manual_linking" data-count="2">
          <button
            className="action-button secondary"
            type="button"
            disabled={isPickingDriver || selectedDriver === null}
            onClick={actions.cancelManualLinkingSelection}
          >
            <span className="action-button-row">
              <MaterialIcon name="close" />
              <span>Cancel</span>
            </span>
          </button>
          <button
            className={`action-button primary${isAllCompleted ? " solve" : ""}`}
            type="button"
            disabled={isPickingDriver && selectedDriver === null && !isAllCompleted}
            onClick={isAllCompleted ? actions.solveManualLinking : actions.nextManualLinkingStep}
          >
            {isAllCompleted ? (
              "Solve"
            ) : isPickingDriver || hasDefinedLink ? (
              "Next"
            ) : (
              <>
                <span className="action-button-row"><span>Next</span></span>
                <span className="action-button-subtitle">nothing else moved</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
