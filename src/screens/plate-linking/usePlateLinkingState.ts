import { useMemo } from "react";
import { applyTestingMove } from "../../lib/appState";
import { canMove, getOffsetBounds, getStep2Selection, hasAnyStep2Selection } from "../../lib/plateMath";
import { beginNextLinkTask, advanceFromStep1, enterSolutionMode, finishLinkCapture, recordPlateAttempt, resetPlates, stepBackLinking, updatePlateOffset } from "./linkingState";
import type { AppStateData, Direction } from "../../lib/types";
import type { Dispatch, SetStateAction } from "react";

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
      setAppState((current) => recordPlateAttempt(current, index, delta));
      return;
    }

    setAppState((current) => updatePlateOffset(current, index, nextOffset, 0));
  }

  function commitDrag(index: number, nextOffset: number, attemptedDirection: number) {
    if (appState.mode === "testing") {
      const delta = nextOffset - appState.offsets[index];
      if (delta !== 0) {
        setAppState((current) => applyTestingMove(current, index, Math.sign(delta)));
      }
      return;
    }

    setAppState((current) => updatePlateOffset(current, index, nextOffset, attemptedDirection));
  }

  return useMemo(() => ({
    movePlate,
    commitDrag,
    stepBackLinking: () => setAppState(stepBackLinking),
    resetPlates: () => setAppState(resetPlates),
    advanceFromStep1: () => setAppState(advanceFromStep1),
    finishLinkCapture: () => setAppState(finishLinkCapture),
    enterSolutionMode: () => setAppState(enterSolutionMode),
    beginNextLinkTask: () => setAppState(beginNextLinkTask),
    selectors: {
      canMove: (index, direction) => canMove(appState, index, direction),
      getOffsetBounds: (index) => getOffsetBounds(appState, index),
      getStep2Selection: (index) => getStep2Selection(appState, index),
      hasAnyStep2Selection: () => hasAnyStep2Selection(appState),
    },
  }), [appState, setAppState]);
}
