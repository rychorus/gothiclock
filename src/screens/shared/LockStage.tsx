import { MaterialIcon } from "../../lib/icons";
import { PlateColumn } from "./PlateColumn";

export function LockStage({
  appState,
  currentSolutionChunk,
  testingFeedback,
  selectors,
  actions,
  showResetButton = false,
  showManualButton = false,
  onOpenManualLinking = null,
  selectionMode = null,
  manualDriverIndex = null,
  onSelectPlate = null,
  instruction = "",
  instructionClassName = "",
}) {
  const hasStageControls = showResetButton || showManualButton;
  const isManualPicking = selectionMode === "manual-pick";
  const isManualDefining = selectionMode === "manual-define";
  const manualState = appState.manualLinkingState;
  const visibleOffsets = appState.mode === "manual_linking" && manualState
    ? manualState.phase === "choose-driver"
      ? Array.from({ length: appState.plateCount }, () => 0)
      : manualState.offsets
    : appState.offsets;
  return (
      <>
      <section className={`lock-stage${appState.mode === "setup" ? " is-setup-mode" : ""}${appState.mode === "solution" || appState.mode === "ready_to_solve" ? " is-solution-compact" : ""}${hasStageControls ? " has-stage-controls" : ""}${instruction ? " has-bottom-instruction" : ""}${isManualPicking ? " is-manual-picking" : ""}${isManualDefining ? " is-manual-defining" : ""}`} hidden={appState.mode === "menu" || appState.mode === "load" || appState.mode === "import"}>
        {instruction ? <div className={`stage-instruction${appState.mode === "linking" || appState.mode === "manual_linking" ? " is-linking-mode" : ""}${appState.mode === "manual_linking" ? " is-manual-mode" : ""}${instructionClassName ? ` ${instructionClassName}` : ""}`} aria-live="polite">{instruction}</div> : null}
        <div className="plates-row" aria-label="Lock plates">
          {visibleOffsets.map((offset, index) => (
              <PlateColumn
              key={index}
              index={index}
              offset={offset}
              mode={appState.mode}
              linkingPromptTask={appState.linkingPromptTask}
              selectionMode={selectionMode}
              manualDriverIndex={manualDriverIndex}
              manualLinkingState={manualState}
              currentSolutionMove={currentSolutionChunk?.move ?? null}
              testingFeedback={testingFeedback}
              selection={selectors.getPlateObservation(index)}
              isKnown={appState.mode === "manual_linking" ? Boolean(manualState?.completedDrivers.includes(index)) : Boolean(appState.links[index])}
              isDeferred={Boolean(
                appState.plateLinkingProcedure?.deferredDrivers
                  .some((entry) => entry.driver === index),
              )}
              plateCount={appState.plateCount}
              bounds={selectors.getOffsetBounds(index)}
              canMoveUp={selectors.canMove(index, "up")}
              canMoveDown={selectors.canMove(index, "down")}
              onMove={actions.movePlate}
              onCommitDrag={actions.commitDrag}
              onSelect={onSelectPlate}
            />
          ))}
        </div>
      </section>

      {(showResetButton || showManualButton) && (appState.mode === "linking" || appState.mode === "testing") ? (
        <div className="stage-inline-actions" data-mode={appState.mode} data-count={showResetButton && showManualButton ? "2" : "1"}>
          {showManualButton ? (
            <button className="stage-manual-linking" type="button" onClick={onOpenManualLinking}>
              Manually Link
            </button>
          ) : null}
          {showResetButton ? (
            <button className="stage-reset" type="button" onClick={appState.mode === "testing" ? actions.resetTestingMode : actions.resetPlateLinkingPrompt}>
              <span className="stage-reset-content">
                <MaterialIcon name="restart_alt" />
                <span>Reset</span>
              </span>
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
