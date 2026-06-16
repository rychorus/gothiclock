import { enterSolutionMode } from "../../../lib/appState";
import { cloneOffsets, createIdentityLink, createManualLinkingState } from "../../../lib/lockData";
import type { AppStateData, Direction } from "../../../lib/types";

export function getManualViewState(state: AppStateData) {
  return state.mode === "manual_linking" && state.manualLinkingState
    ? {
        ...state,
        offsets: state.manualLinkingState.offsets,
      }
    : state;
}

export function setManualLinkRelation(current: AppStateData, targetIndex: number, nextOffset: number) {
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
  const normalizedOffset = Math.max(-1, Math.min(1, nextOffset));
  const relation = normalizedOffset === 0
    ? 0
    : driverDelta === null
      ? Math.sign(normalizedOffset)
      : Math.sign(normalizedOffset) * driverDelta;
  const offsets = cloneOffsets(manual.offsets);
  offsets[targetIndex] = normalizedOffset;

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

export function startManualLinkingMode(current: AppStateData): AppStateData {
  return {
    ...current,
    mode: "manual_linking",
    linkingPromptTask: null,
    plateLinkingProcedure: null,
    manualLinkingState: createManualLinkingState(current),
    solution: null,
  };
}

export function selectManualDriver(current: AppStateData, driver: number, direction: Direction | null = null): AppStateData {
  if (current.manualLinkingState?.phase !== "choose-driver") {
    return current;
  }

  const selectedDirection = direction;
  const offsets = Array.from({ length: current.plateCount }, () => 0);
  if (selectedDirection) {
    offsets[driver] = selectedDirection === "up" ? -1 : 1;
  }

  return {
    ...current,
    manualLinkingState: {
      ...current.manualLinkingState,
      phase: "define-links",
      selectedDriver: driver,
      selectedDirection,
      offsets,
      linkDeltas: current.manualLinkingState.linkDeltas.map((value, linkIndex) => (
        linkIndex === driver && selectedDirection
          ? (selectedDirection === "up" ? -1 : 1)
          : value
      )),
    },
    solution: null,
  };
}

export function nextManualLinkingStep(current: AppStateData): AppStateData {
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
}

export function cancelManualLinkingSelection(current: AppStateData): AppStateData {
  if (current.mode !== "manual_linking" || !current.manualLinkingState) {
    return current;
  }

  const selectedDriver = current.manualLinkingState.selectedDriver;
  if (selectedDriver === null) {
    return current;
  }

  const links = current.manualLinkingState.links.map((link, index) => (
    index === selectedDriver ? null : link
  ));
  const linkDeltas = current.manualLinkingState.linkDeltas.map((value, index) => (
    index === selectedDriver ? null : value
  ));
  const completedDrivers = current.manualLinkingState.completedDrivers.filter((index) => index !== selectedDriver);

  return {
    ...current,
    manualLinkingState: {
      ...current.manualLinkingState,
      phase: "choose-driver",
      selectedDriver: null,
      selectedDirection: null,
      offsets: Array.from({ length: current.plateCount }, () => 0),
      links,
      linkDeltas,
      completedDrivers,
    },
    solution: null,
  };
}

export function solveManualLinking(current: AppStateData): AppStateData {
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
}

export function resetManualLinking(current: AppStateData): AppStateData {
  if (current.mode !== "manual_linking" || !current.manualLinkingState) {
    return current;
  }

  const blankState = createManualLinkingState(current);

  return {
    ...current,
    manualLinkingState: {
      ...blankState,
      links: Array.from({ length: current.plateCount }, () => null),
      linkDeltas: Array.from({ length: current.plateCount }, () => null),
      completedDrivers: [],
    },
    solution: null,
  };
}

export function getManualOffsetBounds(state: AppStateData, index: number) {
  const manual = state.manualLinkingState;
  if (!manual) {
    return { min: 0, max: 0 };
  }

  if (manual.phase === "define-links" && manual.selectedDriver !== null && index === manual.selectedDriver) {
    const selectedOffset = manual.selectedDirection === "up" ? -1 : manual.selectedDirection === "down" ? 1 : 0;
    return { min: selectedOffset, max: selectedOffset };
  }

  return { min: -1, max: 1 };
}

export function canMoveManual(_state: AppStateData, _index: number, _direction: "up" | "down") {
  return true;
}
