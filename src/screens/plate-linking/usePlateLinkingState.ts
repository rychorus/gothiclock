import { useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { applyTestingMove } from "../../lib/appState";
import { cloneOffsets, createIdentityLink, createManualLinkingState } from "../../lib/lockData";
import { enterSolutionMode } from "../../lib/appState";
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
  function getManualViewState(state: AppStateData) {
    return state.mode === "manual_linking" && state.manualLinkingState
      ? {
          ...state,
          offsets: state.manualLinkingState.offsets,
        }
      : state;
  }

  function setManualLinkRelation(current: AppStateData, targetIndex: number, delta: number) {
    const manual = current.manualLinkingState;
    const driver = manual?.selectedDriver;
    if (!manual || manual.phase !== "define-links" || driver === null || driver === undefined || driver === targetIndex) {
      return current;
    }

    const driverDelta = manual.selectedDirection === "up"
      ? -1
      : manual.selectedDirection === "down"
        ? 1
        : null;
    const relation = delta === 0
      ? 0
      : driverDelta === null
        ? Math.sign(delta)
        : Math.sign(delta) * driverDelta;
    const offsets = cloneOffsets(manual.offsets);
    offsets[targetIndex] = delta === 0 ? 0 : Math.sign(delta);

    const links = manual.links.map((link, index) => (
      index === driver
        ? link ? [...link] : createIdentityLink(current.plateCount, driver)
        : link ? [...link] : null
    ));
    const driverLink = links[driver] || createIdentityLink(current.plateCount, driver);
    driverLink[targetIndex] = relation;
    links[driver] = driverLink;

    const linkDeltas = [...manual.linkDeltas];
    linkDeltas[driver] = driverDelta;

    return {
      ...current,
      manualLinkingState: {
        ...manual,
        offsets,
        links,
        linkDeltas,
      },
    };
  }

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
          const offsets = Array.from({ length: current.plateCount }, () => 0);
          offsets[index] = delta;
          return {
            ...current,
            manualLinkingState: {
              ...manual,
              phase: "define-links",
              selectedDriver: index,
              selectedDirection: direction,
              offsets,
              linkDeltas: manual.linkDeltas.map((value, linkIndex) => (
                linkIndex === index ? delta : value
              )),
            },
            solution: null,
          };
        }

        if (manual.phase !== "define-links") {
          return current;
        }

        return setManualLinkRelation(current, index, delta);
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
        if (!manual || manual.phase !== "define-links") {
          return current;
        }

        const selectedDriver = manual.selectedDriver;
        if (selectedDriver === null || selectedDriver === undefined) {
          return current;
        }

        const relation = nextOffset < 0 ? -1 : nextOffset > 0 ? 1 : 0;
        return setManualLinkRelation(current, index, relation);
      });
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

  function startManualLinkingMode() {
    setAppState((current) => ({
      ...current,
      mode: "manual_linking",
      linkingPromptTask: null,
      plateLinkingProcedure: null,
      manualLinkingState: createManualLinkingState(current),
      solution: null,
    }));
  }

  function selectManualDriver(driver: number) {
    setAppState((current) => ({
      ...current,
      manualLinkingState: current.manualLinkingState?.phase === "choose-driver"
        ? {
          ...current.manualLinkingState,
          phase: "define-links",
          selectedDriver: driver,
          selectedDirection: null,
        }
        : current.manualLinkingState,
      solution: null,
    }));
  }

  function nextManualLinkingStep() {
    setAppState((current) => {
      if (current.mode !== "manual_linking" || !current.manualLinkingState) {
        return current;
      }

      if (current.manualLinkingState.phase === "choose-driver") {
        if (current.manualLinkingState.selectedDriver === null) {
          return current;
        }

        return {
          ...current,
          manualLinkingState: {
            ...current.manualLinkingState,
            phase: "define-links",
          },
        };
      }

      const selectedDriver = current.manualLinkingState.selectedDriver;
      if (selectedDriver === null) {
        return current;
      }

      const completedDrivers = current.manualLinkingState.completedDrivers.includes(selectedDriver)
        ? current.manualLinkingState.completedDrivers
        : [...current.manualLinkingState.completedDrivers, selectedDriver].sort((left, right) => left - right);
      const links = current.manualLinkingState.links.map((link, index) => (
        index === selectedDriver
          ? link || createIdentityLink(current.plateCount, selectedDriver)
          : link
      ));
      const offsets = Array.from({ length: current.plateCount }, () => 0);
      const selectedDirection = current.manualLinkingState.selectedDirection;
      const linkDeltas = current.manualLinkingState.linkDeltas.map((value, index) => (
        index === selectedDriver
          ? (selectedDirection === "up" ? -1 : selectedDirection === "down" ? 1 : value)
          : value
      ));

      return {
        ...current,
        manualLinkingState: {
          ...current.manualLinkingState,
          phase: "choose-driver",
          selectedDriver: null,
          selectedDirection: null,
          offsets,
          linkDeltas,
          completedDrivers,
          links,
        },
      };
    });
  }

  function solveManualLinking() {
    setAppState((current) => {
      if (current.mode !== "manual_linking" || !current.manualLinkingState) {
        return current;
      }

      const manual = current.manualLinkingState;
      const isComplete = manual.links.every(Boolean) || manual.completedDrivers.length >= current.plateCount;
      if (!isComplete) {
        return current;
      }

      const nextState: AppStateData = {
        ...current,
        mode: "linking",
        offsets: cloneOffsets(manual.offsets),
        links: manual.links.map((link) => (link ? [...link] : null)),
        linkDeltas: [...manual.linkDeltas],
        linkingPromptTask: null,
        plateLinkingProcedure: null,
        manualLinkingState: null,
        solution: null,
      };

      return enterSolutionMode(nextState);
    });
  }

  return useMemo(() => ({
    movePlate,
    commitDrag,
    startManualLinkingMode,
    selectManualDriver,
    nextManualLinkingStep,
    solveManualLinking,
    stepBackPlateLinkingPrompt: () => setAppState(stepBackPlateLinkingPrompt),
    resetPlateLinkingPrompt: () => setAppState(resetPlateLinkingProcedure),
    advancePlateLinkingPrompt: () => setAppState(advancePlateLinkingPrompt),
    completePlateLinkingPrompt: () => setAppState(completePlateLinkingObservation),
    selectors: {
      canMove: (index, direction) => {
        if (appState.mode === "manual_linking") {
          return true;
        }

        return canMove(getManualViewState(appState), index, direction);
      },
      getOffsetBounds: (index) => {
        if (appState.mode === "manual_linking") {
          const manual = appState.manualLinkingState;
          if (!manual) {
            return { min: 0, max: 0 };
          }

          if (manual.phase === "define-links" && manual.selectedDriver !== null && index === manual.selectedDriver) {
            const selectedOffset = manual.selectedDirection === "up" ? -1 : manual.selectedDirection === "down" ? 1 : 0;
            return { min: selectedOffset, max: selectedOffset };
          }

          return { min: -1, max: 1 };
        }

        return getOffsetBounds(getManualViewState(appState), index);
      },
      getPlateObservation: (index) => getPlateObservation(appState, index),
      hasPlateObservation: () => hasPlateObservation(appState),
    },
  }), [appState, setAppState]);
}
