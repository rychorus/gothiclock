import { PlateColumn } from "./PlateColumn";
import { getStageInstruction } from "./screenUtils";

export function LockStage({ appState, currentSolutionChunk, testingFeedback, selectors, actions, showResetButton = false }) {
  const stageInstruction = getStageInstruction(appState, currentSolutionChunk);
  const deferredDrivers = new Set((appState.deferredLinkTasks || []).map((task) => task.driver));

  if (appState.currentTask?.wasDeferred) {
    deferredDrivers.add(appState.currentTask.driver);
  }

  return (
    <>
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

      {showResetButton && (appState.mode === "linking" || appState.mode === "testing") ? (
        <div className="stage-inline-actions" data-mode={appState.mode}>
          <button className="stage-reset" type="button" onClick={appState.mode === "testing" ? actions.resetTestingMode : actions.resetPlates}>
            Reset
          </button>
        </div>
      ) : null}
    </>
  );
}
