import type { PlateLinkingPromptTask } from "./types";

export function PlateLinkingPromptActions({
  task,
  hasObservation,
  isFirstStep,
  onBack,
  onAdvance,
  onComplete,
}: {
  task: PlateLinkingPromptTask | null;
  hasObservation: boolean;
  isFirstStep: boolean;
  onBack: () => void;
  onAdvance: () => void;
  onComplete: () => void;
}) {
  const isObserve = task?.phase === "observe";
  const isStalled = task?.phase === "stalled";
  const isReset = task?.phase === "reset";

  return (
    <div className="footer-actions" data-mode="linking" data-count="2">
      <button className="action-button secondary" type="button" onClick={onBack}>
        <span className="action-button-row">
          <span className="action-icon is-left" aria-hidden="true"></span>
          <span>{isFirstStep ? "Back to setup" : "Back"}</span>
        </span>
      </button>
      <button
        className="action-button primary"
        type="button"
        disabled={!task || isStalled || isReset}
        onClick={isObserve ? onComplete : onAdvance}
      >
        {isReset ? (
          "Press Reset"
        ) : isStalled ? (
          "Guided linking stalled"
        ) : isObserve && !hasObservation ? (
          <>
            <span className="action-button-row"><span>Next</span></span>
            <span className="action-button-subtitle">nothing else moved</span>
          </>
        ) : (
          "Next"
        )}
      </button>
    </div>
  );
}
