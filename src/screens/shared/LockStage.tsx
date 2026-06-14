import { PlateColumn } from "./PlateColumn";

export function LockStage({ appState, currentSolutionChunk, testingFeedback, selectors, actions, showResetButton = false, instruction = "" }) {
  return (
    <>
      <section className={`lock-stage${appState.mode === "solution" || appState.mode === "ready_to_solve" ? " is-solution-compact" : ""}`} hidden={appState.mode === "menu" || appState.mode === "load" || appState.mode === "import"}>
        {instruction ? <div className={`stage-instruction${appState.mode === "linking" ? " is-linking-mode" : ""}`} aria-live="polite">{instruction}</div> : null}
        <div className="plates-row" aria-label="Lock plates">
          {appState.offsets.map((offset, index) => (
            <PlateColumn
              key={index}
              index={index}
              offset={offset}
              mode={appState.mode}
              linkingPromptTask={appState.linkingPromptTask}
              currentSolutionMove={currentSolutionChunk?.move ?? null}
              testingFeedback={testingFeedback}
              selection={selectors.getPlateObservation(index)}
              isKnown={Boolean(appState.links[index])}
              isDeferred={false}
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
          <button className="stage-reset" type="button" onClick={appState.mode === "testing" ? actions.resetTestingMode : actions.resetPlateLinkingPrompt}>
            Reset
          </button>
        </div>
      ) : null}
    </>
  );
}
