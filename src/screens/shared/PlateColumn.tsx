import { useMemo, useRef, useState } from "react";
import { getVisiblePlateLabel } from "../../lib/notation";

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
  selectionMode = null,
  manualDriverIndex = null,
  manualLinkingState = null,
  currentSolutionMove,
  testingFeedback,
  selection,
  isKnown,
  isDeferred,
  plateCount,
  bounds,
  canMoveUp,
  canMoveDown,
  onMove,
  onCommitDrag,
  onSelect,
}) {
  const viewportRef = useRef(null);
  const holeRef = useRef(null);
  const stackRef = useRef(null);
  const dragStateRef = useRef(null);
  const [dragPixels, setDragPixels] = useState(null);
  const isManualPickMode = selectionMode === "manual-pick";
  const isManualDefineMode = selectionMode === "manual-define";
  const isManualActiveDriver = manualDriverIndex !== null && manualDriverIndex === index;
  const isManualCompleted = Boolean(manualLinkingState?.completedDrivers.includes(index));
  const selectedDirectionDelta = manualLinkingState?.selectedDirection === "up" ? -1 : manualLinkingState?.selectedDirection === "down" ? 1 : 0;
  const isObservePhase = mode === "linking" && linkingPromptTask?.phase === "observe";
  const observedOffsetDelta = isObservePhase
    ? offset - (linkingPromptTask?.baseOffsets?.[index] ?? offset)
    : 0;
  const blockedObservationDelta = isObservePhase ? (linkingPromptTask?.blockedObservations?.[index] ?? 0) : 0;
  const isManualLinked = Boolean(
    isManualDefineMode
    && manualDriverIndex !== null
    && manualDriverIndex !== index
    && manualLinkingState?.links[manualDriverIndex]?.[index],
  );
  const isDriver = linkingPromptTask?.driver === index;
  const manualMovedOffset = isManualDefineMode ? (manualLinkingState?.offsets[index] ?? 0) : 0;
  const isManualLinkedLeft = isManualDefineMode && manualMovedOffset === -1;
  const isManualLinkedRight = isManualDefineMode && manualMovedOffset === 1;
  const showKnownStatus = mode === "linking" && isKnown && !isDriver;
  const showSolutionLabel = mode === "solution" && Number.isInteger(plateCount) && plateCount > 0;
  const isSolutionLabelActive = showSolutionLabel && currentSolutionMove?.plate === index;
  const plateLabel = showSolutionLabel ? getVisiblePlateLabel(index, plateCount) : "";
  const displayOffset = isManualPickMode
    ? (isManualActiveDriver ? selectedDirectionDelta : 0)
    : isManualDefineMode && isManualActiveDriver
      ? selectedDirectionDelta
      : offset;

  const classes = useMemo(() => {
    const nextClasses = ["plate-column"];

    if (isDriver) {
      nextClasses.push("is-driver");
    }

    if (mode === "linking" && linkingPromptTask?.phase === "observe" && isDriver) {
      nextClasses.push("is-driver-focus");
    }

    if (showKnownStatus) {
      nextClasses.push("is-known");
    }

    if (isDeferred && mode === "linking") {
      nextClasses.push("is-deferred");
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

    if (mode === "linking" && (linkingPromptTask?.phase === "move" || linkingPromptTask?.phase === "center") && isDriver) {
      nextClasses.push(linkingPromptTask.direction === "up" ? "is-body-prompt-up" : "is-body-prompt-down");
    }

    if (currentSolutionMove?.plate === index) {
      nextClasses.push(currentSolutionMove.direction === "up" ? "is-prompt-up" : "is-prompt-down");
      nextClasses.push(currentSolutionMove.direction === "up" ? "is-body-prompt-up" : "is-body-prompt-down");
    }

    if (isManualPickMode || isManualDefineMode) {
      nextClasses.push("is-manual-selection");
    }

    if (isManualPickMode) {
      nextClasses.push("is-manual-pick");
    }

    if (isManualDefineMode) {
      nextClasses.push("is-manual-define");
    }

    if (isManualDefineMode && isManualActiveDriver) {
      nextClasses.push("is-manual-driver");
    }

    if (isManualPickMode && isManualCompleted) {
      nextClasses.push("is-manual-completed");
    }

    if (isManualPickMode) {
      nextClasses.push("is-manual-selectable");
    }

    if (isManualDefineMode && !isManualActiveDriver) {
      nextClasses.push("is-manual-selectable");
    }

    if (isManualDefineMode && isManualLinked && manualMovedOffset !== 0) {
      nextClasses.push(manualMovedOffset > 0 ? "is-manual-linked-same" : "is-manual-linked-opposite");
    }

    if (offset === 0) {
      nextClasses.push("is-aligned");
    }

    return nextClasses.join(" ");
  }, [
    currentSolutionMove,
    index,
    isDeferred,
    isKnown,
    isManualActiveDriver,
    isManualDefineMode,
    isManualLinked,
    isManualPickMode,
    linkingPromptTask,
    manualMovedOffset,
    mode,
    offset,
    selection,
    testingFeedback,
  ]);

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
    if (isManualActiveDriver) {
      return;
    }

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

    if (isManualPickMode) {
      const selectedDirection = snappedOffset < dragState.startOffset
        ? "up"
        : snappedOffset > dragState.startOffset
          ? "down"
          : attemptedDirection < 0
            ? "up"
            : attemptedDirection > 0
              ? "down"
              : null;

      if (selectedDirection) {
        onMove(index, selectedDirection);
      }
      return;
    }

    onCommitDrag(index, snappedOffset, snappedOffset !== dragState.startOffset ? 0 : attemptedDirection);
  }

  function handleSelect(event) {
    if (!isManualDefineMode) {
      return;
    }

    event.preventDefault();
    onSelect?.(index);
  }

  function handleKeyDown(event) {
    if (!isManualDefineMode) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect?.(index);
    }
  }

  const hideMoveButtons = mode === "solution" || mode === "ready_to_solve" || isManualActiveDriver;
  const isSuggestedPrompt = mode === "linking"
    && (linkingPromptTask?.phase === "move" || linkingPromptTask?.phase === "center")
    && linkingPromptTask?.driver === index;
  const leftSuggested = isSuggestedPrompt && linkingPromptTask.direction === "up";
  const rightSuggested = isSuggestedPrompt && linkingPromptTask.direction === "down";
  const leftObserved = isObservePhase && (observedOffsetDelta < 0 || blockedObservationDelta < 0);
  const rightObserved = isObservePhase && (observedOffsetDelta > 0 || blockedObservationDelta > 0);

  return (
    <article
      className={`${classes}${showSolutionLabel ? " is-solution-labeled" : ""}`}
      data-plate-index={index}
      role={isManualDefineMode ? "button" : undefined}
      tabIndex={isManualDefineMode ? 0 : undefined}
      aria-label={isManualDefineMode ? `Choose plate ${index + 1}` : undefined}
      onClick={isManualDefineMode ? handleSelect : undefined}
      onKeyDown={isManualDefineMode ? handleKeyDown : undefined}
    >
      {showSolutionLabel ? <div className={`plate-column-label${isSolutionLabelActive ? " is-active" : ""}`} aria-hidden="true">{plateLabel}</div> : null}
      <button
        className={`plate-button${leftSuggested ? " is-suggested" : ""}${leftObserved ? " is-observed-left" : ""}${isManualLinkedLeft ? " is-manual-linked-left" : ""}`}
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
        <div className="plate-track" style={{ transform: getTransformValue(displayOffset, dragPixels) }}>
          <div className="plate-body">
            {showKnownStatus ? (
              <div className="plate-status-row" aria-hidden="true">
                <span className="plate-status"></span>
              </div>
            ) : null}
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
        className={`plate-button${rightSuggested ? " is-suggested" : ""}${rightObserved ? " is-observed-right" : ""}${isManualLinkedRight ? " is-manual-linked-right" : ""}`}
        type="button"
        data-direction="right"
        aria-label="Move plate right"
        hidden={hideMoveButtons}
        disabled={!canMoveDown}
        onClick={() => onMove(index, "down")}
      >
        <span></span>
      </button>

    </article>
  );
}
