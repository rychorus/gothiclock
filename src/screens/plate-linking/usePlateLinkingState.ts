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
  completePlateLinkingObservation,
  resetPlateLinkingProcedure,
} from "./procedure/plateLinkingProcedure";

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

    const bounds = getOffsetBounds(appState, index);
    const nextOffset = appState.offsets[index] + delta;
    if (nextOffset < bounds.min || nextOffset > bounds.max) {
      if (appState.mode === "linking") {
        setAppState((current) => recordBlockedPlateLinkingObservation(current, index, delta));
      }
      return;
    }

    if (appState.mode === "linking") {
      setAppState((current) => updatePlateLinkingObservation(current, index, nextOffset));
      return;
    }

    setAppState((current) => {
      const offsets = cloneOffsets(current.offsets);
      offsets[index] = nextOffset;
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

    if (appState.mode === "linking") {
      setAppState((current) => (
        attemptedDelta !== 0
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

  return useMemo(() => ({
    movePlate,
    commitDrag,
    stepBackPlateLinkingPrompt: () => setAppState(stepBackPlateLinkingPrompt),
    resetPlateLinkingPrompt: () => setAppState(resetPlateLinkingProcedure),
    advancePlateLinkingPrompt: () => setAppState(advancePlateLinkingPrompt),
    completePlateLinkingPrompt: () => setAppState(completePlateLinkingObservation),
    selectors: {
      canMove: (index, direction) => canMove(appState, index, direction),
      getOffsetBounds: (index) => getOffsetBounds(appState, index),
      getPlateObservation: (index) => getPlateObservation(appState, index),
      hasPlateObservation: () => hasPlateObservation(appState),
    },
  }), [appState, setAppState]);
}
