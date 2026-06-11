(function () {
  const { CENTER_INDEX, HOLE_COUNT, clampOffset, refs, state } = window.GothicLockpickCore;

  function createPlateController(app) {
    function getTrackOffset(offset) {
      return offset * state.stepSize;
    }

    function getOffsetBounds(index) {
      if (state.mode === "setup") {
        return { min: -CENTER_INDEX, max: CENTER_INDEX };
      }

      if (state.mode === "linking" && state.currentTask) {
        if (state.currentTask.phase === "step1") {
          return { min: state.offsets[index], max: state.offsets[index] };
        }

        if (state.currentTask.phase === "step2") {
          const baseOffset = state.currentTask.baseOffsets[index];

          if (index === state.currentTask.driver) {
            return { min: baseOffset, max: baseOffset };
          }

          return {
            min: clampOffset(baseOffset - 1),
            max: clampOffset(baseOffset + 1),
          };
        }
      }

      return { min: state.offsets[index], max: state.offsets[index] };
    }

    function canMove(index, direction) {
      const delta = direction === "up" ? -1 : 1;

      if (state.mode === "linking" && state.currentTask?.phase === "step2" && index !== state.currentTask.driver) {
        return true;
      }

      const bounds = getOffsetBounds(index);
      const nextOffset = state.offsets[index] + delta;
      return nextOffset >= bounds.min && nextOffset <= bounds.max;
    }

    function getStep2Selection(index) {
      if (state.mode !== "linking" || !state.currentTask || state.currentTask.phase !== "step2") {
        return 0;
      }

      const actualDelta = state.offsets[index] - state.currentTask.baseOffsets[index];
      if (actualDelta !== 0) {
        return actualDelta;
      }

      return state.currentTask.attempts?.[index] || 0;
    }

    function hasAnyStep2Selection() {
      if (state.mode !== "linking" || !state.currentTask || state.currentTask.phase !== "step2") {
        return false;
      }

      return state.offsets.some((_, index) => index !== state.currentTask.driver && getStep2Selection(index) !== 0);
    }

    function applyMove(index, delta) {
      const bounds = getOffsetBounds(index);
      const nextOffset = state.offsets[index] + delta;

      if (nextOffset < bounds.min || nextOffset > bounds.max) {
        return false;
      }

      state.offsets[index] = nextOffset;
      return true;
    }

    function movePlate(index, direction) {
      const delta = direction === "up" ? -1 : 1;
      if (!applyMove(index, delta)) {
        if (state.mode === "linking" && state.currentTask?.phase === "step2" && index !== state.currentTask.driver) {
          state.currentTask.attempts[index] = delta;
          refreshPlateUI();
        }
        return;
      }

      if (state.mode === "linking" && state.currentTask?.phase === "step2" && index !== state.currentTask.driver) {
        state.currentTask.attempts[index] = 0;
      }

      refreshPlateUI();
    }

    function enableDrag(viewport, index) {
      let startY = 0;
      let startOffset = 0;
      let lastClientY = 0;

      viewport.addEventListener("pointerdown", (event) => {
        const bounds = getOffsetBounds(index);
        if (bounds.min === bounds.max) {
          return;
        }

        event.preventDefault();
        viewport.setPointerCapture(event.pointerId);
        viewport.classList.add("is-dragging");
        startY = event.clientY;
        startOffset = state.offsets[index];
        lastClientY = event.clientY;
      });

      viewport.addEventListener("pointermove", (event) => {
        if (!viewport.classList.contains("is-dragging")) {
          return;
        }

        lastClientY = event.clientY;
        const bounds = getOffsetBounds(index);
        const deltaPixels = event.clientY - startY;
        const nextPixels = getTrackOffset(startOffset) + deltaPixels;
        const minPixels = getTrackOffset(bounds.min);
        const maxPixels = getTrackOffset(bounds.max);
        const clampedPixels = Math.max(minPixels, Math.min(maxPixels, nextPixels));

        setDraggingPosition(index, clampedPixels);
      });

      function finishDrag(event) {
        if (!viewport.classList.contains("is-dragging")) {
          return;
        }

        if (typeof event.clientY === "number" && event.clientY !== 0) {
          lastClientY = event.clientY;
        }

        const bounds = getOffsetBounds(index);
        const snappedDelta = Math.round((lastClientY - startY) / state.stepSize);
        const snappedOffset = Math.max(bounds.min, Math.min(bounds.max, startOffset + snappedDelta));

        state.offsets[index] = snappedOffset;
        if (state.mode === "linking" && state.currentTask?.phase === "step2" && index !== state.currentTask.driver) {
          const attemptedDirection = lastClientY === startY ? 0 : (lastClientY < startY ? -1 : 1);
          if (snappedOffset !== startOffset) {
            state.currentTask.attempts[index] = 0;
          } else if (attemptedDirection !== 0) {
            state.currentTask.attempts[index] = attemptedDirection;
          }
        }
        viewport.classList.remove("is-dragging");
        refreshPlateUI();
      }

      viewport.addEventListener("pointerup", finishDrag);
      viewport.addEventListener("pointercancel", finishDrag);
    }

    function setDraggingPosition(index, offsetPixels) {
      const track = refs.platesRow.querySelector(`[data-plate-index="${index}"] .plate-track`);
      if (!track) {
        return;
      }

      track.style.transform = `translateY(calc(-50% + ${offsetPixels}px))`;
    }

    function updatePlatePosition(index) {
      const track = refs.platesRow.querySelector(`[data-plate-index="${index}"] .plate-track`);
      if (!track) {
        return;
      }

      track.style.transform = `translateY(calc(-50% + ${getTrackOffset(state.offsets[index])}px))`;
    }

    function measureStepSize() {
      const sampleStack = refs.platesRow.querySelector(".hole-stack");
      const sampleHole = sampleStack?.querySelector(".hole");
      if (!sampleStack || !sampleHole) {
        return;
      }

      const stackStyles = window.getComputedStyle(sampleStack);
      const gap = parseFloat(stackStyles.rowGap || stackStyles.gap || "0");
      const holeHeight = sampleHole.getBoundingClientRect().height;
      state.stepSize = gap + holeHeight;
    }

    function createPlate(index) {
      const fragment = refs.plateTemplate.content.cloneNode(true);
      const column = fragment.querySelector(".plate-column");
      const holeStack = fragment.querySelector(".hole-stack");
      const buttons = fragment.querySelectorAll(".plate-button");
      const viewport = fragment.querySelector(".plate-viewport");
      const track = fragment.querySelector(".plate-track");

      column.dataset.plateIndex = String(index);

      for (let i = 0; i < HOLE_COUNT; i += 1) {
        const hole = document.createElement("span");
        hole.className = "hole";
        if (i === CENTER_INDEX) {
          hole.classList.add("is-center-hole");
        }
        holeStack.appendChild(hole);
      }

      buttons.forEach((button) => {
        button.addEventListener("click", () => {
          movePlate(index, button.dataset.direction);
        });
      });

      enableDrag(viewport, index);
      track?.classList.add("is-initializing");

      return fragment;
    }

    function applyPlateState(column, index) {
      const viewport = column.querySelector(".plate-viewport");
      const buttons = column.querySelectorAll(".plate-button");
      const selection = getStep2Selection(index);
      const isDriver = state.currentTask?.driver === index;
      const isKnown = Boolean(state.links[index]);
      const bounds = getOffsetBounds(index);
      const shouldShowStatus = state.mode === "linking";
      const currentSolutionMove = app.getCurrentSolutionChunk()?.move ?? null;
      const hideMoveButtons = state.mode === "solution" || state.mode === "ready_to_solve";

      column.classList.remove(
        "is-driver",
        "is-driver-focus",
        "is-known",
        "is-linked-same",
        "is-linked-opposite",
        "is-step2-selected",
        "is-body-prompt-up",
        "is-body-prompt-down",
        "is-prompt-up",
        "is-prompt-down"
      );
      viewport.classList.toggle("is-locked", bounds.min === bounds.max);
      column.classList.toggle("show-status", shouldShowStatus);

      if (isDriver) {
        column.classList.add("is-driver");
      }

      if (state.mode === "linking" && state.currentTask?.phase === "step2" && isDriver) {
        column.classList.add("is-driver-focus");
      }

      if (isKnown && state.mode === "linking") {
        column.classList.add("is-known");
      }

      if (selection === state.currentTask?.delta && selection !== 0) {
        column.classList.add("is-linked-same");
      }

      if (selection === state.currentTask?.delta * -1 && selection !== 0) {
        column.classList.add("is-linked-opposite");
      }

      if (state.mode === "linking" && state.currentTask?.phase === "step2" && selection !== 0) {
        column.classList.add("is-step2-selected");
      }

      if (state.mode === "linking" && isDriver) {
        column.classList.add(state.currentTask.direction === "up" ? "is-prompt-up" : "is-prompt-down");
      }

      if (state.mode === "linking" && state.currentTask?.phase === "step1" && isDriver) {
        column.classList.add(state.currentTask.direction === "up" ? "is-body-prompt-up" : "is-body-prompt-down");
      }

      if (currentSolutionMove && currentSolutionMove.plate === index) {
        column.classList.add(currentSolutionMove.direction === "up" ? "is-prompt-up" : "is-prompt-down");
        column.classList.add(currentSolutionMove.direction === "up" ? "is-body-prompt-up" : "is-body-prompt-down");
      }

      buttons.forEach((button) => {
        button.hidden = hideMoveButtons;
        const direction = button.dataset.direction;
        button.disabled = !canMove(index, direction);
        button.classList.remove("is-suggested", "is-same", "is-opposite");

        if (
          state.mode === "linking" &&
          state.currentTask?.phase === "step1" &&
          isDriver &&
          direction === state.currentTask.direction
        ) {
          button.classList.add("is-suggested");
        }

        if (selection !== 0 && state.mode === "linking" && state.currentTask?.phase === "step2") {
          if (direction === (selection === -1 ? "up" : "down")) {
            button.classList.add(selection === state.currentTask.delta ? "is-same" : "is-opposite");
          }
        }

        if (currentSolutionMove && currentSolutionMove.plate === index && direction === currentSolutionMove.direction) {
          button.classList.add("is-suggested");
        }
      });
    }

    function getPromptSignature() {
      if (state.mode === "linking" && state.currentTask?.phase === "step1") {
        return `link:${state.currentTask.driver}:${state.currentTask.direction}`;
      }

      const currentChunk = app.getCurrentSolutionChunk();
      if (currentChunk) {
        return currentChunk.move
          ? `solve:${state.solution.index}:${currentChunk.move.plate}:${currentChunk.move.direction}`
          : `solve:${state.solution.index}:reset`;
      }

      return "";
    }

    function restartPromptAnimations() {
      const promptedColumns = refs.platesRow.querySelectorAll(".plate-column.is-prompt-up, .plate-column.is-prompt-down");
      promptedColumns.forEach((column) => {
        const animatedElements = column.querySelectorAll(".plate-body, .plate-direction-cue");
        animatedElements.forEach((element) => {
          element.style.animation = "none";
        });
        void column.offsetHeight;
        animatedElements.forEach((element) => {
          element.style.animation = "";
        });
      });
    }

    function renderPlates() {
      refs.platesRow.innerHTML = "";

      for (let index = 0; index < state.plateCount; index += 1) {
        refs.platesRow.appendChild(createPlate(index));
      }

      measureStepSize();
      refreshPlateUI();
      requestAnimationFrame(() => {
        refs.platesRow.querySelectorAll(".plate-track.is-initializing").forEach((track) => {
          track.classList.remove("is-initializing");
        });
      });
    }

    function refreshPlateUI() {
      const columns = refs.platesRow.querySelectorAll(".plate-column");
      columns.forEach((column, index) => {
        applyPlateState(column, index);
        updatePlatePosition(index);
      });

      const promptSignature = getPromptSignature();
      if (promptSignature && promptSignature !== state.lastPromptSignature) {
        restartPromptAnimations();
      }
      state.lastPromptSignature = promptSignature;

      app.renderFooterActions();
    }

    return {
      applyMove,
      applyPlateState,
      canMove,
      createPlate,
      enableDrag,
      getOffsetBounds,
      getPromptSignature,
      getStep2Selection,
      getTrackOffset,
      hasAnyStep2Selection,
      measureStepSize,
      movePlate,
      refreshPlateUI,
      renderPlates,
      restartPromptAnimations,
      setDraggingPosition,
      updatePlatePosition,
    };
  }

  window.GothicLockpickPlateUI = {
    createPlateController,
  };
}());
