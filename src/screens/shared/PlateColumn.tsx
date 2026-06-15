import { useMemo, useRef, useState } from "react";

function getTransformValue(offset, dragPixels) {
  if (dragPixels !== null) {
    return `translate(calc(-50% + ${dragPixels}px), -50%)`;
  }

  return `translate(calc(-50% + (${offset}) * (var(--hole-size) + var(--hole-gap))), -50%)`;
}

export function PlateColumn({
  index,
  offset,
  mode,
  linkingPromptTask,
  currentSolutionMove,
  testingFeedback,
  selection,
  isKnown,
  isDeferred,
  bounds,
  canMoveUp,
  canMoveDown,
  onMove,
  onCommitDrag,
  bottomNote,
}) {
  const viewportRef = useRef(null);
  const holeRef = useRef(null);
  const stackRef = useRef(null);
  const dragStateRef = useRef(null);
  const [dragPixels, setDragPixels] = useState(null);

  const classes = useMemo(() => {
    const nextClasses = ["plate-column"];
    const isDriver = linkingPromptTask?.driver === index;

    if (isDriver) {
      nextClasses.push("is-driver");
    }

    if (mode === "linking" && linkingPromptTask?.phase === "observe" && isDriver) {
      nextClasses.push("is-driver-focus");
    }

    if (isKnown && mode === "linking" && !isDriver) {
      nextClasses.push("is-known");
    }

    if (isDeferred && mode === "linking") {
      nextClasses.push("is-deferred");
    }

    if (selection === linkingPromptTask?.delta && selection !== 0) {
      nextClasses.push("is-linked-same");
    }

    if (selection === linkingPromptTask?.delta * -1 && selection !== 0) {
      nextClasses.push("is-linked-opposite");
    }

    if (mode === "linking" && linkingPromptTask?.phase === "observe" && selection !== 0) {
      nextClasses.push("is-step2-selected");
    }

    if (mode === "testing" && testingFeedback?.driver === index) {
      nextClasses.push(testingFeedback.delta === -1 ? "is-testing-bounce-up" : "is-testing-bounce-down");
    }

    if (mode === "testing" && testingFeedback?.blockedPlates?.includes(index)) {
      nextClasses.push("is-testing-blocked");
    }

    if (mode === "linking" && isDriver) {
      nextClasses.push(linkingPromptTask.direction === "up" ? "is-prompt-up" : "is-prompt-down");
    }

    if (mode === "linking" && linkingPromptTask?.phase === "move" && isDriver) {
      nextClasses.push(linkingPromptTask.direction === "up" ? "is-body-prompt-up" : "is-body-prompt-down");
    }

    if (currentSolutionMove?.plate === index) {
      nextClasses.push(currentSolutionMove.direction === "up" ? "is-prompt-up" : "is-prompt-down");
      nextClasses.push(currentSolutionMove.direction === "up" ? "is-body-prompt-up" : "is-body-prompt-down");
    }

    if (mode === "linking") {
      nextClasses.push("show-status");
    }

    if (offset === 0) {
      nextClasses.push("is-aligned");
    }

    return nextClasses.join(" ");
  }, [currentSolutionMove, index, isDeferred, isKnown, linkingPromptTask, mode, offset, selection, testingFeedback]);

  function measureStepSize() {
    if (!holeRef.current || !stackRef.current) {
      return 0;
    }

    const stackStyles = window.getComputedStyle(stackRef.current);
    const gap = parseFloat(stackStyles.columnGap || stackStyles.gap || "0");
    const holeWidth = holeRef.current.getBoundingClientRect().width;
    return gap + holeWidth;
  }

  function handlePointerDown(event) {
    if (bounds.min === bounds.max || !viewportRef.current) {
      return;
    }

    event.preventDefault();
    const stepSize = measureStepSize();
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      lastClientX: event.clientX,
      startOffset: offset,
      stepSize,
    };
    viewportRef.current.setPointerCapture(event.pointerId);
    viewportRef.current.classList.add("is-dragging");
  }

  function handlePointerMove(event) {
    const dragState = dragStateRef.current;
    if (!dragState) {
      return;
    }

    dragState.lastClientX = event.clientX;
    const deltaPixels = event.clientX - dragState.startX;
    const nextPixels = dragState.startOffset * dragState.stepSize + deltaPixels;
    const minPixels = bounds.min * dragState.stepSize;
    const maxPixels = bounds.max * dragState.stepSize;
    setDragPixels(Math.max(minPixels, Math.min(maxPixels, nextPixels)));
  }

  function handlePointerFinish(event) {
    const dragState = dragStateRef.current;
    if (!dragState || !viewportRef.current) {
      return;
    }

    const finalX = typeof event.clientX === "number" && event.clientX !== 0 ? event.clientX : dragState.lastClientX;
    const snappedDelta = Math.round((finalX - dragState.startX) / dragState.stepSize);
    const snappedOffset = Math.max(bounds.min, Math.min(bounds.max, dragState.startOffset + snappedDelta));
    const attemptedDirection = finalX === dragState.startX ? 0 : finalX < dragState.startX ? -1 : 1;

    viewportRef.current.classList.remove("is-dragging");
    viewportRef.current.releasePointerCapture?.(dragState.pointerId);
    dragStateRef.current = null;
    setDragPixels(null);
    onCommitDrag(index, snappedOffset, snappedOffset !== dragState.startOffset ? 0 : attemptedDirection);
  }

  const hideMoveButtons = mode === "solution" || mode === "ready_to_solve";
  const leftSuggested = mode === "linking" && linkingPromptTask?.phase === "move" && linkingPromptTask?.driver === index && linkingPromptTask.direction === "up";
  const rightSuggested = mode === "linking" && linkingPromptTask?.phase === "move" && linkingPromptTask?.driver === index && linkingPromptTask.direction === "down";

  return (
    <article className={classes} data-plate-index={index}>
      <button
        className={`plate-button${leftSuggested ? " is-suggested" : ""}`}
        type="button"
        data-direction="left"
        aria-label="Move plate left"
        hidden={hideMoveButtons}
        disabled={!canMoveUp}
        onClick={() => onMove(index, "up")}
      >
        <span></span>
      </button>

      <div
        ref={viewportRef}
        className={`plate-viewport${bounds.min === bounds.max ? " is-locked" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerFinish}
        onPointerCancel={handlePointerFinish}
      >
        <div className="plate-direction-cue" aria-hidden="true">
          <span></span>
        </div>
        <div className="center-band" aria-hidden="true">
          <span className="center-marker">
            <span className="center-marker-cap"></span>
            <span className="center-dot"></span>
          </span>
        </div>
        <div className="plate-track" style={{ transform: getTransformValue(offset, dragPixels) }}>
          <div className="plate-body">
            <div ref={stackRef} className="hole-stack">
              {Array.from({ length: 7 }, (_, holeIndex) => (
                <span
                  key={holeIndex}
                  ref={holeIndex === 0 ? holeRef : undefined}
                  className={`hole${holeIndex === 3 ? " is-center-hole" : ""}`}
                ></span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <button
        className={`plate-button${rightSuggested ? " is-suggested" : ""}`}
        type="button"
        data-direction="right"
        aria-label="Move plate right"
        hidden={hideMoveButtons}
        disabled={!canMoveDown}
        onClick={() => onMove(index, "down")}
      >
        <span></span>
      </button>

      <div className="plate-status-row">
        <span className="plate-status" aria-hidden="true"></span>
      </div>

      {bottomNote ? <div className="plate-column-note" aria-live="polite">{bottomNote}</div> : null}
    </article>
  );
}
