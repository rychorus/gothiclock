import {
  CENTER_INDEX,
  cloneOffsets,
  createEmptyLinkDeltas,
  createEmptyLinks,
  createIdentityLink,
} from "../../../lib/lockData";
import { buildSolutionPlanForApp } from "../../../lib/solution";
import type { AppStateData, PlateLink } from "../../../lib/types";
import { createPlateLinkingPromptTask } from "../prompt/plateLinkingPromptState";
import type {
  DeferredPlateLink,
  PlateLinkingProcedureState,
} from "./types";

function unique(values: number[]): number[] {
  return [...new Set(values)];
}

function createProcedureState(state: AppStateData): PlateLinkingProcedureState {
  return {
    completedDrivers: state.links
      .map((link, index) => (link ? index : -1))
      .filter((index) => index >= 0),
    pendingDrivers: [],
    deferredDrivers: [],
    partialLinks: {},
    lastTriedDeltas: {},
    history: [],
  };
}

function areAllUncompletedPlatesCentered(state: AppStateData, procedure: PlateLinkingProcedureState): boolean {
  return state.offsets.every((offset, index) => (
    procedure.completedDrivers.includes(index)
    || offset === 0
  ));
}

function pushProcedureHistory(
  state: AppStateData,
  procedure: PlateLinkingProcedureState,
): AppStateData {
  return {
    ...state,
    plateLinkingProcedure: {
      ...procedure,
      history: [...procedure.history, state],
    },
  };
}

export function findFarthestPlate(
  offsets: number[],
  completedDrivers: number[],
  excludedDrivers: number[] = [],
): number | null {
  const completed = new Set(completedDrivers);
  const excluded = new Set(excludedDrivers);
  const candidates = offsets
    .map((offset, index) => ({ index, distance: Math.abs(offset) }))
    .filter(({ index }) => !completed.has(index) && !excluded.has(index))
    .sort((left, right) => right.distance - left.distance || right.index - left.index);

  return candidates[0]?.index ?? null;
}

function canApplyDelta(offset: number, delta: number): boolean {
  const nextOffset = offset + delta;
  return nextOffset >= -CENTER_INDEX && nextOffset <= CENTER_INDEX;
}

function getProbeDelta(offset: number, lastTriedDelta?: number): number {
  const preferredDelta = offset > 0 ? -1 : 1;
  if (lastTriedDelta === preferredDelta && canApplyDelta(offset, -preferredDelta)) {
    return -preferredDelta;
  }

  if (canApplyDelta(offset, preferredDelta)) {
    return preferredDelta;
  }

  return -preferredDelta;
}

function isBlockerResolved(
  blocker: number,
  state: AppStateData,
  procedure: PlateLinkingProcedureState,
): boolean {
  return procedure.completedDrivers.includes(blocker)
    || Math.abs(state.offsets[blocker]) < CENTER_INDEX;
}

function isDeferredWhileBlockersAreAtEdge(
  driver: number,
  state: AppStateData,
  procedure: PlateLinkingProcedureState,
): boolean {
  const deferred = procedure.deferredDrivers.find((entry) => entry.driver === driver);
  return Boolean(
    deferred
    && deferred.blockedBy.some((blocker) => !isBlockerResolved(blocker, state, procedure)),
  );
}

function canReachDriver(
  fromDriver: number,
  targetDriver: number,
  procedure: PlateLinkingProcedureState,
  visited = new Set<number>(),
): boolean {
  if (fromDriver === targetDriver) {
    return true;
  }
  if (visited.has(fromDriver)) {
    return false;
  }

  visited.add(fromDriver);
  const deferred = procedure.deferredDrivers.find((entry) => entry.driver === fromDriver);
  return Boolean(
    deferred?.blockedBy.some((blocker) => (
      canReachDriver(blocker, targetDriver, procedure, visited)
    )),
  );
}

function getDependencyCycleDrivers(
  procedure: PlateLinkingProcedureState,
  currentDriver?: number,
): number[] {
  if (currentDriver === undefined) {
    return [];
  }

  const drivers = unique(procedure.deferredDrivers.flatMap((entry) => [
    entry.driver,
    ...entry.blockedBy,
  ]));
  const cycleDrivers = drivers.filter((driver) => (
    driver !== currentDriver
    && canReachDriver(currentDriver, driver, procedure)
    && canReachDriver(driver, currentDriver, procedure)
  ));

  return cycleDrivers.length > 0
    ? [currentDriver, ...cycleDrivers]
    : [];
}

function takePendingDriver(
  state: AppStateData,
  procedure: PlateLinkingProcedureState,
  excludedDrivers: number[],
  currentDriver?: number,
): { driver: number | null; pendingDrivers: number[] } {
  const pendingDrivers = [...procedure.pendingDrivers];
  const excluded = new Set(excludedDrivers);

  while (pendingDrivers.length > 0) {
    const driver = pendingDrivers.shift();
    if (
      driver !== undefined
      && driver !== currentDriver
      && !excluded.has(driver)
      && !procedure.completedDrivers.includes(driver)
      && !isDeferredWhileBlockersAreAtEdge(driver, state, procedure)
    ) {
      return { driver, pendingDrivers };
    }
  }

  return { driver: null, pendingDrivers };
}

export function selectNextPlateLinkingDriver(
  state: AppStateData,
  procedure: PlateLinkingProcedureState,
  currentDriver?: number,
): { driver: number | null; procedure: PlateLinkingProcedureState } {
  const cycleDrivers = getDependencyCycleDrivers(procedure, currentDriver);
  const pendingResult = takePendingDriver(state, procedure, cycleDrivers, currentDriver);
  const nextProcedure = {
    ...procedure,
    pendingDrivers: pendingResult.pendingDrivers,
  };

  if (pendingResult.driver !== null) {
    return { driver: pendingResult.driver, procedure: nextProcedure };
  }

  const readyDeferred = nextProcedure.deferredDrivers.find((entry) => (
    entry.driver !== currentDriver
    && !cycleDrivers.includes(entry.driver)
    && !nextProcedure.completedDrivers.includes(entry.driver)
    && entry.blockedBy.every((blocker) => isBlockerResolved(blocker, state, nextProcedure))
  ));
  if (readyDeferred) {
    return { driver: readyDeferred.driver, procedure: nextProcedure };
  }

  const blockedDeferredDrivers = nextProcedure.deferredDrivers
    .filter((entry) => isDeferredWhileBlockersAreAtEdge(entry.driver, state, nextProcedure))
    .map((entry) => entry.driver);
  const farthest = findFarthestPlate(
    state.offsets,
    nextProcedure.completedDrivers,
    unique([
      ...blockedDeferredDrivers,
      ...cycleDrivers,
      ...(currentDriver === undefined ? [] : [currentDriver]),
    ]),
  );
  if (farthest !== null) {
    return { driver: farthest, procedure: nextProcedure };
  }

  // If every unfinished plate belongs to the same blocked cycle, there is no
  // unrelated probe available. Alternate one member's direction as a last resort.
  return {
    driver: findFarthestPlate(
      state.offsets,
      nextProcedure.completedDrivers,
      currentDriver === undefined ? [] : [currentDriver],
    ) ?? findFarthestPlate(state.offsets, nextProcedure.completedDrivers),
    procedure: nextProcedure,
  };
}

function beginNextPrompt(
  state: AppStateData,
  procedure: PlateLinkingProcedureState,
  currentDriver?: number,
): AppStateData {
  if (areAllUncompletedPlatesCentered(state, procedure)) {
    const startOffsets = cloneOffsets(state.linkingStartOffsets || state.offsets);
    const returnState: AppStateData = {
      ...state,
      solutionReturnState: null,
    };
    const solutionState: AppStateData = {
      ...state,
      mode: "solution",
      offsets: startOffsets,
      linkingPromptTask: null,
      plateLinkingProcedure: procedure,
      solutionReturnState: returnState,
    };
    return {
      ...solutionState,
      solution: buildSolutionPlanForApp(solutionState, startOffsets),
    };
  }

  const selection = selectNextPlateLinkingDriver(state, procedure, currentDriver);
  if (selection.driver === null) {
    const startOffsets = cloneOffsets(state.linkingStartOffsets || state.offsets);
    const returnState: AppStateData = {
      ...state,
      solutionReturnState: null,
    };
    const solutionState: AppStateData = {
      ...state,
      mode: "solution",
      offsets: startOffsets,
      linkingPromptTask: null,
      plateLinkingProcedure: selection.procedure,
      solutionReturnState: returnState,
    };
    return {
      ...solutionState,
      solution: buildSolutionPlanForApp(solutionState, startOffsets),
    };
  }

  const delta = getProbeDelta(
    state.offsets[selection.driver],
    selection.procedure.lastTriedDeltas[selection.driver],
  );
  return {
    ...state,
    mode: "linking",
    linkingPromptTask: createPlateLinkingPromptTask(state, selection.driver, delta),
    plateLinkingProcedure: selection.procedure,
    solution: null,
  };
}

export function startPlateLinkingProcedure(state: AppStateData): AppStateData {
  const linkingStartOffsets = cloneOffsets(state.linkingStartOffsets || state.offsets);
  const procedure = createProcedureState(state);
  return beginNextPrompt(
    {
      ...state,
      mode: "linking",
      linkingStartOffsets,
      plateLinkingProcedure: procedure,
      solution: null,
    },
    procedure,
  );
}

export function startFreshPlateLinkingProcedure(state: AppStateData): AppStateData {
  const linkingStartOffsets = cloneOffsets(state.offsets);
  return startPlateLinkingProcedure({
    ...state,
    linkingStartOffsets,
    links: createEmptyLinks(state.plateCount),
    linkDeltas: createEmptyLinkDeltas(state.plateCount),
    linkingPromptTask: null,
    plateLinkingProcedure: null,
    solution: null,
  });
}

function buildObservedLink(state: AppStateData): PlateLink {
  const task = state.linkingPromptTask;
  if (!task) {
    return [];
  }

  const link = createIdentityLink(state.plateCount, task.driver);
  for (let index = 0; index < state.plateCount; index += 1) {
    if (index === task.driver) {
      continue;
    }

    const actualDelta = state.offsets[index] - (task.baseOffsets?.[index] ?? state.offsets[index]);
    const observedDelta = task.blockedObservations[index] || actualDelta;
    if (observedDelta !== 0) {
      link[index] = observedDelta / task.delta;
    }
  }
  return link;
}

function mergeLinks(base: PlateLink, addition: PlateLink): PlateLink {
  return base.map((value, index) => addition[index] || value);
}

function upsertDeferred(
  deferredDrivers: DeferredPlateLink[],
  driver: number,
  blockedBy: number[],
): DeferredPlateLink[] {
  const existing = deferredDrivers.find((entry) => entry.driver === driver);
  if (!existing) {
    return [...deferredDrivers, { driver, blockedBy: unique(blockedBy) }];
  }

  return deferredDrivers.map((entry) => (
    entry.driver === driver
      ? { ...entry, blockedBy: unique([...entry.blockedBy, ...blockedBy]) }
      : entry
  ));
}

export function completePlateLinkingObservation(state: AppStateData): AppStateData {
  const task = state.linkingPromptTask;
  const procedure = state.plateLinkingProcedure;
  if (state.mode !== "linking" || task?.phase !== "observe" || !procedure) {
    return state;
  }

  const observedLink = buildObservedLink(state);
  const partialLink = mergeLinks(
    procedure.partialLinks[task.driver] || createIdentityLink(state.plateCount, task.driver),
    observedLink,
  );
  const blockedBy = task.blockedObservations
    .map((delta, index) => (delta !== 0 ? index : -1))
    .filter((index) => index >= 0);
  const lastTriedDeltas = {
    ...procedure.lastTriedDeltas,
    [task.driver]: task.delta,
  };

  if (blockedBy.length > 0) {
    const nextProcedure: PlateLinkingProcedureState = {
      ...procedure,
      pendingDrivers: unique([...blockedBy, ...procedure.pendingDrivers]),
      deferredDrivers: upsertDeferred(procedure.deferredDrivers, task.driver, blockedBy),
      partialLinks: {
        ...procedure.partialLinks,
        [task.driver]: partialLink,
      },
      lastTriedDeltas,
      history: procedure.history,
    };
    const nextState = pushProcedureHistory(
      {
        ...state,
        offsets: cloneOffsets(task.startOffsets),
      },
      nextProcedure,
    );

    // A coupled plate at the edge prevents the whole attempted movement.
    return beginNextPrompt(
      nextState,
      nextState.plateLinkingProcedure!,
      task.driver,
    );
  }

  const links = [...state.links];
  links[task.driver] = partialLink;
  const linkDeltas = [...state.linkDeltas];
  linkDeltas[task.driver] = task.delta;
  const completedDrivers = unique([...procedure.completedDrivers, task.driver]);
  const nextProcedure: PlateLinkingProcedureState = {
    ...procedure,
    completedDrivers,
    deferredDrivers: procedure.deferredDrivers.filter((entry) => entry.driver !== task.driver),
    partialLinks: Object.fromEntries(
      Object.entries(procedure.partialLinks)
        .filter(([driver]) => Number(driver) !== task.driver),
    ),
    lastTriedDeltas,
    history: procedure.history,
  };
  const nextState = pushProcedureHistory(
    {
      ...state,
      links,
      linkDeltas,
    },
    nextProcedure,
  );

  return beginNextPrompt(
    nextState,
    nextState.plateLinkingProcedure!,
    task.driver,
  );
}

export function resetPlateLinkingProcedure(state: AppStateData): AppStateData {
  if (!state.linkingStartOffsets) {
    return state;
  }

  const offsets = cloneOffsets(state.linkingStartOffsets);
  const procedure = state.plateLinkingProcedure || createProcedureState(state);
  return beginNextPrompt(
    {
      ...state,
      offsets,
      plateLinkingProcedure: procedure,
    },
    procedure,
  );
}
