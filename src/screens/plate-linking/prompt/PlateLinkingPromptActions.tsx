import type { PlateLinkingPromptTask } from "./types";

export function PlateLinkingPromptActions({
  task,
  hasObservation,
  onBack,
  onAdvance,
  onComplete,
}: {
  task: PlateLinkingPromptTask | null;
  hasObservation: boolean;
  onBack: () => void;
  onAdvance: () => void;
  onComplete: () => void;
}) {
  const isComplete = task?.phase === "complete";
  const isObserve = task?.phase === "observe";

  return (
    <div className="footer-actions" data-mode="linking" data-count="2">
      <button className="action-button secondary" type="button" onClick={onBack}>
        <span className="action-button-row">
          <span className="action-icon is-left" aria-hidden="true"></span>
          <span>{task?.phase === "move" ? "Back to setup" : "Back"}</span>
        </span>
      </button>
      <button
        className="action-button primary"
        type="button"
        disabled={!task || isComplete}
        onClick={isObserve ? onComplete : onAdvance}
      >
        {isObserve && !hasObservation ? (
          <>
            <span className="action-button-row"><span>Next</span></span>
            <span className="action-button-subtitle">nothing else moved</span>
          </>
        ) : (
          isComplete ? "Observation captured" : "Next"
        )}
      </button>
    </div>
  );
}
