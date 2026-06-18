import { useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { applyTestingMove } from "../../lib/appState";
import { cloneOffsets } from "../../lib/lockData";
import { playPlateClick, playPlateClicks } from "../../lib/plateClick";
import { canMove, getOffsetBounds, getPlateObservation, hasPlateObservation } from "../../lib/plateMath";
import type { AppStateData, Direction } from "../../lib/types";
import {
  advancePlateLinkingPrompt,
  recordBlockedPlateLinkingObservation,
  stepBackPlateLinkingPrompt,
  updatePlateLinkingObservation,
} from "./prompt/plateLinkingPromptState";
import {
  advancePlateLinkingCenterPrompt,
  advancePlateLinkingResetPrompt,
  completePlateLinkingObservation,
  resetPlateLinkingProcedure,
} from "./procedure/plateLinkingProcedure";
import {
  canMoveManual,
  getManualOffsetBounds,
  getManualViewState,
  cancelManualLinkingSelection as cancelManualLinkingSelectionState,
  nextManualLinkingStep as nextManualLinkingStepState,
  selectManualDriver as selectManualDriverState,
  setManualLinkRelation,
  recordBlockedManualLinkRelation,
  resetManualLinking as resetManualLinkingState,
  solveManualLinking as solveManualLinkingState,
  startManualLinkingMode as startManualLinkingModeState,
} from "./manual/useManualPlateLinkingState";

export function usePlateLinkingState({
  appState,
  setAppState,
  onPlateLinkingInteraction,
}: {
  appState: AppStateData;
  setAppState: Dispatch<SetStateAction<AppStateData>>;
  onPlateLinkingInteraction?: () => void;
}) {
  function movePlate(index: number, direction: Direction) {
    const delta = direction === "up" ? -1 : 1;

    if (appState.mode === "testing") {
      setAppState((current) => applyTestingMove(current, index, delta));
      return;
    }

    if (appState.mode === "manual_linking") {
      const manual = appState.manualLinkingState;
      if (!manual) {
        return;
      }

      if (manual.phase === "choose-driver") {
        if (direction) {
          playPlateClick();
        }
        setAppState((current) => selectManualDriverState(current, index, direction));
        return;
      }

      if (manual.phase !== "define-links") {
        return;
      }

      const currentOffset = manual.offsets[index] ?? 0;
      const nextOffset = Math.max(-1, Math.min(1, currentOffset + delta));
      if (nextOffset === currentOffset) {
        setAppState((current) => recordBlockedManualLinkRelation(current, index, delta));
        return;
      }

      playPlateClick();
      setAppState((current) => {
        return setManualLinkRelation(current, index, nextOffset);
      });
      return;
    }

    if (appState.mode === "linking") {
      onPlateLinkingInteraction?.();
      const viewState = getManualViewState(appState);
      const bounds = getOffsetBounds(viewState, index);
      const nextOffset = viewState.offsets[index] + delta;
      if (nextOffset < bounds.min || nextOffset > bounds.max) {
        setAppState((current) => recordBlockedPlateLinkingObservation(current, index, delta));
        return;
      }
      playPlateClicks(Math.abs(nextOffset - viewState.offsets[index]));
      setAppState((current) => updatePlateLinkingObservation(current, index, nextOffset));
      return;
    }

    playPlateClick();
    setAppState((current) => {
      const offsets = cloneOffsets(current.offsets);
      offsets[index] = current.offsets[index] + delta;
      return { ...current, offsets };
    });
  }

  function commitDrag(index: number, nextOffset: number, attemptedDelta = 0) {
    if (appState.mode === "testing") {
      const delta = nextOffset - appState.offsets[index];
      if (delta !== 0) {
        setAppState((current) => applyTestingMove(current, index, Math.sign(delta)));
      }
      return;
    }

    if (appState.mode === "manual_linking") {
      const manual = appState.manualLinkingState;
      if (!manual || manual.phase !== "define-links") {
        return;
      }

      const currentOffset = manual.offsets[index] ?? 0;
      const bounds = getManualOffsetBounds(appState, index);
      const isBlockedAttempt = attemptedDelta !== 0
        && nextOffset === currentOffset
        && (
          (attemptedDelta < 0 && currentOffset <= bounds.min)
          || (attemptedDelta > 0 && currentOffset >= bounds.max)
        );

      setAppState((current) => {
        return isBlockedAttempt
          ? recordBlockedManualLinkRelation(current, index, attemptedDelta)
          : setManualLinkRelation(current, index, nextOffset);
      });
      return;
    }

    if (appState.mode === "linking") {
      const currentOffset = appState.offsets[index] ?? 0;
      const bounds = getOffsetBounds(getManualViewState(appState), index);
      const isBlockedAttempt = attemptedDelta !== 0
        && nextOffset === currentOffset
        && (
          (attemptedDelta < 0 && currentOffset <= bounds.min)
          || (attemptedDelta > 0 && currentOffset >= bounds.max)
        );

      onPlateLinkingInteraction?.();
      setAppState((current) => (
        isBlockedAttempt
          ? recordBlockedPlateLinkingObservation(current, index, attemptedDelta)
          : updatePlateLinkingObservation(current, index, nextOffset)
      ));
      return;
    }

    setAppState((current) => {
      const offsets = cloneOffsets(current.offsets);
      offsets[index] = nextOffset;
      return { ...current, offsets };
    });
  }

  function startManualLinkingMode() {
    setAppState(startManualLinkingModeState);
  }

  function selectManualDriver(driver: number) {
    setAppState((current) => selectManualDriverState(current, driver));
  }

  function nextManualLinkingStep() {
    setAppState(nextManualLinkingStepState);
  }

  function solveManualLinking() {
    setAppState(solveManualLinkingState);
  }

  function resetManualLinking() {
    setAppState(resetManualLinkingState);
  }

  function cancelManualLinkingSelection() {
    setAppState(cancelManualLinkingSelectionState);
  }

  return useMemo(() => ({
    movePlate,
    commitDrag,
    startManualLinkingMode,
    selectManualDriver,
    nextManualLinkingStep,
    solveManualLinking,
    resetManualLinking,
    cancelManualLinkingSelection,
    stepBackPlateLinkingPrompt: () => setAppState(stepBackPlateLinkingPrompt),
    resetPlateLinkingPrompt: () => {
      if (appState.linkingPromptTask?.phase === "reset") {
        playPlateClick();
        setAppState(advancePlateLinkingResetPrompt);
        return;
      }

      setAppState(resetPlateLinkingProcedure);
    },
    advancePlateLinkingPrompt: () => {
      playPlateClick();
      setAppState((current) => (
        current.linkingPromptTask?.phase === "center"
          ? advancePlateLinkingCenterPrompt(current)
          : current.linkingPromptTask?.phase === "reset"
            ? advancePlateLinkingResetPrompt(current)
            : advancePlateLinkingPrompt(current)
      ));
    },
    completePlateLinkingPrompt: () => setAppState(completePlateLinkingObservation),
    selectors: {
      canMove: (index, direction) => {
        if (appState.mode === "manual_linking") {
          return canMoveManual(appState, index, direction);
        }

        return canMove(getManualViewState(appState), index, direction);
      },
      getOffsetBounds: (index) => {
        if (appState.mode === "manual_linking") {
          return getManualOffsetBounds(appState, index);
        }

        return getOffsetBounds(getManualViewState(appState), index);
      },
      getPlateObservation: (index) => getPlateObservation(appState, index),
      hasPlateObservation: () => hasPlateObservation(appState),
    },
  }), [appState, setAppState, onPlateLinkingInteraction]);
}
