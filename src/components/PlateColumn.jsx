import { useMemo, useRef, useState } from "react";

function getTransformValue(offset, dragPixels) {
  if (dragPixels !== null) {
    return `translateY(calc(-50% + ${dragPixels}px))`;
  }

  return `translateY(calc(-50% + (${offset}) * (var(--hole-size) + var(--hole-gap))))`;
}

export function PlateColumn({
  index,
  offset,
  mode,
  currentTask,
  currentSolutionMove,
  testingFeedback,
  selection,
  isKnown,
  bounds,
  canMoveUp,
  canMoveDown,
  onMove,
  onCommitDrag,
}) {
  const viewportRef = useRef(null);
  const holeRef = useRef(null);
  const stackRef = useRef(null);
  const dragStateRef = useRef(null);
  const [dragPixels, setDragPixels] = useState(null);

  const classes = useMemo(() => {
    const nextClasses = ["plate-column"];
    const isDriver = currentTask?.driver === index;

    if (isDriver) {
      nextClasses.push("is-driver");
    }

    if (mode === "linking" && currentTask?.phase === "step2" && isDriver) {
      nextClasses.push("is-driver-focus");
    }

    if (isKnown && mode === "linking") {
      nextClasses.push("is-known");
    }

    if (selection === currentTask?.delta && selection !== 0) {
      nextClasses.push("is-linked-same");
    }

    if (selection === currentTask?.delta * -1 && selection !== 0) {
      nextClasses.push("is-linked-opposite");
    }

    if (mode === "linking" && currentTask?.phase === "step2" && selection !== 0) {
      nextClasses.push("is-step2-selected");
    }

    if (mode === "testing" && testingFeedback?.driver === index) {
      nextClasses.push(testingFeedback.delta === -1 ? "is-testing-bounce-up" : "is-testing-bounce-down");
    }

    if (mode === "testing" && testingFeedback?.blockedPlates?.includes(index)) {
      nextClasses.push("is-testing-blocked");
    }

    if (mode === "linking" && isDriver) {
      nextClasses.push(currentTask.direction === "up" ? "is-prompt-up" : "is-prompt-down");
    }

    if (mode === "linking" && currentTask?.phase === "step1" && isDriver) {
      nextClasses.push(currentTask.direction === "up" ? "is-body-prompt-up" : "is-body-prompt-down");
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
  }, [currentSolutionMove, currentTask, index, isKnown, mode, offset, selection, testingFeedback]);

  function measureStepSize() {
    if (!holeRef.current || !stackRef.current) {
      return 0;
    }

    const stackStyles = window.getComputedStyle(stackRef.current);
    const gap = parseFloat(stackStyles.rowGap || stackStyles.gap || "0");
    const holeHeight = holeRef.current.getBoundingClientRect().height;
    return gap + holeHeight;
  }

  function handlePointerDown(event) {
    if (bounds.min === bounds.max || !viewportRef.current) {
      return;
    }

    event.preventDefault();
    const stepSize = measureStepSize();
    dragStateRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastClientY: event.clientY,
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

    dragState.lastClientY = event.clientY;
    const deltaPixels = event.clientY - dragState.startY;
    const nextPixels = (dragState.startOffset * dragState.stepSize) + deltaPixels;
    const minPixels = bounds.min * dragState.stepSize;
    const maxPixels = bounds.max * dragState.stepSize;
    setDragPixels(Math.max(minPixels, Math.min(maxPixels, nextPixels)));
  }

  function handlePointerFinish(event) {
    const dragState = dragStateRef.current;
    if (!dragState || !viewportRef.current) {
      return;
    }

    const finalY = typeof event.clientY === "number" && event.clientY !== 0 ? event.clientY : dragState.lastClientY;
    const snappedDelta = Math.round((finalY - dragState.startY) / dragState.stepSize);
    const snappedOffset = Math.max(bounds.min, Math.min(bounds.max, dragState.startOffset + snappedDelta));
    const attemptedDirection = finalY === dragState.startY ? 0 : (finalY < dragState.startY ? -1 : 1);

    viewportRef.current.classList.remove("is-dragging");
    viewportRef.current.releasePointerCapture?.(dragState.pointerId);
    dragStateRef.current = null;
    setDragPixels(null);
    onCommitDrag(index, snappedOffset, snappedOffset !== dragState.startOffset ? 0 : attemptedDirection);
  }

  const hideMoveButtons = mode === "solution" || mode === "ready_to_solve";

  return (
    <article className={classes} data-plate-index={index}>
      <button
        className={`plate-button${mode === "linking" && currentTask?.phase === "step1" && currentTask?.driver === index && currentTask.direction === "up" ? " is-suggested" : ""}`}
        type="button"
        data-direction="up"
        aria-label="Move plate up"
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
        className={`plate-button${mode === "linking" && currentTask?.phase === "step1" && currentTask?.driver === index && currentTask.direction === "down" ? " is-suggested" : ""}`}
        type="button"
        data-direction="down"
        aria-label="Move plate down"
        hidden={hideMoveButtons}
        disabled={!canMoveDown}
        onClick={() => onMove(index, "down")}
      >
        <span></span>
      </button>

      <div className="plate-status-row">
        <span className="plate-status" aria-hidden="true"></span>
      </div>
    </article>
  );
}
