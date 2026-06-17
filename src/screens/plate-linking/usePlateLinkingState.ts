import { useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { applyTestingMove } from "../../lib/appState";
import { cloneOffsets } from "../../lib/lockData";
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

export function usePlateLinkingState({ appState, setAppState }: {
  appState: AppStateData;
  setAppState: Dispatch<SetStateAction<AppStateData>>;
}) {
  function movePlate(index: number, direction: Direction) {
    const delta = direction === "up" ? -1 : 1;

    if (appState.mode === "testing") {
      setAppState((current) => applyTestingMove(current, index, delta));
      return;
    }

    if (appState.mode === "manual_linking") {
      setAppState((current) => {
        const manual = current.manualLinkingState;
        if (!manual) {
          return current;
        }

        if (manual.phase === "choose-driver") {
          return selectManualDriverState(current, index, direction);
        }

        if (manual.phase !== "define-links") {
          return current;
        }

        const currentOffset = manual.offsets[index] ?? 0;
        const nextOffset = Math.max(-1, Math.min(1, currentOffset + delta));
        if (nextOffset === currentOffset) {
          return recordBlockedManualLinkRelation(current, index, delta);
        }
        return setManualLinkRelation(current, index, nextOffset);
      });
      return;
    }

    if (appState.mode === "linking") {
      const viewState = getManualViewState(appState);
      const bounds = getOffsetBounds(viewState, index);
      const nextOffset = viewState.offsets[index] + delta;
      if (nextOffset < bounds.min || nextOffset > bounds.max) {
        setAppState((current) => recordBlockedPlateLinkingObservation(current, index, delta));
        return;
      }
      setAppState((current) => updatePlateLinkingObservation(current, index, nextOffset));
      return;
    }

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
      setAppState((current) => {
        const manual = current.manualLinkingState;
        if (manual?.phase !== "define-links") {
          return current;
        }

        const currentOffset = manual.offsets[index] ?? 0;
        const bounds = getManualOffsetBounds(current, index);
        const isBlockedAttempt = attemptedDelta !== 0
          && nextOffset === currentOffset
          && (
            (attemptedDelta < 0 && currentOffset <= bounds.min)
            || (attemptedDelta > 0 && currentOffset >= bounds.max)
          );

        return isBlockedAttempt
          ? recordBlockedManualLinkRelation(current, index, attemptedDelta)
          : setManualLinkRelation(current, index, nextOffset);
      });
      return;
    }

    if (appState.mode === "linking") {
      setAppState((current) => {
        const currentOffset = current.offsets[index] ?? 0;
        const bounds = getOffsetBounds(getManualViewState(current), index);
        const isBlockedAttempt = attemptedDelta !== 0
          && nextOffset === currentOffset
          && (
            (attemptedDelta < 0 && currentOffset <= bounds.min)
            || (attemptedDelta > 0 && currentOffset >= bounds.max)
          );

        return isBlockedAttempt
          ? recordBlockedPlateLinkingObservation(current, index, attemptedDelta)
          : updatePlateLinkingObservation(current, index, nextOffset);
      });
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
    resetPlateLinkingPrompt: () => setAppState(resetPlateLinkingProcedure),
    advancePlateLinkingPrompt: () => setAppState((current) => (
      current.linkingPromptTask?.phase === "center"
        ? advancePlateLinkingCenterPrompt(current)
        : advancePlateLinkingPrompt(current)
    )),
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
  }), [appState, setAppState]);
}
