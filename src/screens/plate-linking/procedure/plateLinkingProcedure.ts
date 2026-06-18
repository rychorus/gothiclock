import {
  CENTER_INDEX,
  cloneOffsets,
  createEmptyLinkDeltas,
  createEmptyLinks,
  createIdentityLink,
} from "../../../lib/lockData";
import { buildSolutionPlanForApp } from "../../../lib/solution";
import type { AppStateData, PlateLink } from "../../../lib/types";
import {
  createPlateLinkingCenterPromptTask,
  createPlateLinkingPromptTask,
  createPlateLinkingResetPromptTask,
  createPlateLinkingStalledPromptTask,
} from "../prompt/plateLinkingPromptState";
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
    seenPromptKeys: [],
    history: [],
  };
}

function hasKnownIncomingLink(
  state: AppStateData,
  procedure: PlateLinkingProcedureState,
  targetIndex: number,
): boolean {
  const knownLinks: Array<{ sourceIndex: number; link: PlateLink }> = [
    ...state.links
      .map((link, sourceIndex) => (link ? { sourceIndex, link } : null))
      .filter((entry): entry is { sourceIndex: number; link: PlateLink } => Boolean(entry)),
    ...Object.entries(procedure.partialLinks)
      .map(([sourceIndex, link]) => ({ sourceIndex: Number(sourceIndex), link })),
  ];

  return knownLinks.some(({ sourceIndex, link }) => (
    sourceIndex !== targetIndex && link[targetIndex] !== 0
  ));
}

function shouldProceedToSolution(state: AppStateData, procedure: PlateLinkingProcedureState): boolean {
  const unresolvedPlates = state.offsets
    .map((offset, index) => ({ offset, index }))
    .filter(({ index }) => !procedure.completedDrivers.includes(index));

  return unresolvedPlates.every(({ index, offset }) => (
    offset === 0 && !hasKnownIncomingLink(state, procedure, index)
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

function canApplyLinkedDelta(offsets: number[], link: PlateLink, delta: number): boolean {
  return link.every((relation, index) => {
    if (relation === 0) {
      return true;
    }

    const nextOffset = offsets[index] + relation * delta;
    return nextOffset >= -CENTER_INDEX && nextOffset <= CENTER_INDEX;
  });
}

function applyLinkedDelta(offsets: number[], link: PlateLink, delta: number): number[] {
  return offsets.map((offset, index) => (
    link[index] === 0
      ? offset
      : offset + link[index] * delta
  ));
}

function scoreLinkedCentering(offsets: number[], link: PlateLink) {
  return link.reduce((score, relation, index) => {
    if (relation === 0) {
      return score;
    }

    const distance = Math.abs(offsets[index]);
    return {
      maxDistance: Math.max(score.maxDistance, distance),
      totalDistance: score.totalDistance + distance,
      edgeCount: score.edgeCount + (distance === CENTER_INDEX ? 1 : 0),
    };
  }, { maxDistance: 0, totalDistance: 0, edgeCount: 0 });
}

function compareCenteringScores(
  left: ReturnType<typeof scoreLinkedCentering>,
  right: ReturnType<typeof scoreLinkedCentering>,
): number {
  return left.maxDistance - right.maxDistance
    || left.edgeCount - right.edgeCount
    || left.totalDistance - right.totalDistance;
}

function getCenteringDelta(state: AppStateData, driver: number): number | null {
  const link = state.links[driver];
  if (!link) {
    return null;
  }

  const currentScore = scoreLinkedCentering(state.offsets, link);
  const candidates = [-1, 1]
    .filter((delta) => canApplyLinkedDelta(state.offsets, link, delta))
    .map((delta) => ({
      delta,
      score: scoreLinkedCentering(applyLinkedDelta(state.offsets, link, delta), link),
    }))
    .filter(({ score }) => compareCenteringScores(score, currentScore) < 0)
    .sort((left, right) => (
      compareCenteringScores(left.score, right.score)
      || Math.abs(state.offsets[driver] + left.delta) - Math.abs(state.offsets[driver] + right.delta)
      || left.delta - right.delta
    ));

  return candidates[0]?.delta ?? null;
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
): boolean {
  return Math.abs(state.offsets[blocker]) < CENTER_INDEX;
}

function isDeferredWhileBlockersAreAtEdge(
  driver: number,
  state: AppStateData,
  procedure: PlateLinkingProcedureState,
): boolean {
  const deferred = procedure.deferredDrivers.find((entry) => entry.driver === driver);
  return Boolean(
    deferred
    && deferred.blockedBy.some((blocker) => !isBlockerResolved(blocker, state)),
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

function countEdgeBlockers(
  offsets: number[],
  procedure: PlateLinkingProcedureState,
): number {
  return unique(procedure.deferredDrivers.flatMap((entry) => entry.blockedBy))
    .filter((blocker) => Math.abs(offsets[blocker]) === CENTER_INDEX)
    .length;
}

function findKnownRecoveryMove(
  state: AppStateData,
  procedure: PlateLinkingProcedureState,
): { driver: number; delta: number } | null {
  const currentBlockerCount = countEdgeBlockers(state.offsets, procedure);
  if (currentBlockerCount === 0) {
    return null;
  }

  const candidates = state.links.flatMap((link, driver) => {
    if (!link) {
      return [];
    }

    return [-1, 1]
      .filter((delta) => canApplyLinkedDelta(state.offsets, link, delta))
      .map((delta) => {
        const nextOffsets = applyLinkedDelta(state.offsets, link, delta);
        return {
          driver,
          delta,
          blockerCount: countEdgeBlockers(nextOffsets, procedure),
          centeringScore: scoreLinkedCentering(nextOffsets, link),
        };
      })
      .filter(({ blockerCount }) => blockerCount < currentBlockerCount);
  });

  candidates.sort((left, right) => (
    left.blockerCount - right.blockerCount
    || compareCenteringScores(left.centeringScore, right.centeringScore)
    || left.driver - right.driver
    || left.delta - right.delta
  ));

  return candidates[0] || null;
}

function findDeferredEscapeProbe(
  state: AppStateData,
  procedure: PlateLinkingProcedureState,
): { driver: number; delta: number } | null {
  const candidates = procedure.deferredDrivers.flatMap((entry) => {
    const lastDelta = procedure.lastTriedDeltas[entry.driver];
    const partialLink = procedure.partialLinks[entry.driver];
    if (!lastDelta || !partialLink || procedure.completedDrivers.includes(entry.driver)) {
      return [];
    }

    const delta = -lastDelta;
    if (!canApplyLinkedDelta(state.offsets, partialLink, delta)) {
      return [];
    }

    const currentBlocked = entry.blockedBy
      .filter((blocker) => Math.abs(state.offsets[blocker]) === CENTER_INDEX)
      .length;
    const nextOffsets = applyLinkedDelta(state.offsets, partialLink, delta);
    const nextBlocked = entry.blockedBy
      .filter((blocker) => Math.abs(nextOffsets[blocker]) === CENTER_INDEX)
      .length;

    return nextBlocked < currentBlocked
      ? [{ driver: entry.driver, delta, improvement: currentBlocked - nextBlocked }]
      : [];
  });

  candidates.sort((left, right) => (
    right.improvement - left.improvement
    || Math.abs(state.offsets[left.driver]) - Math.abs(state.offsets[right.driver])
    || left.driver - right.driver
  ));

  return candidates[0] || null;
}

function findResetEscapeProbe(
  state: AppStateData,
  procedure: PlateLinkingProcedureState,
): { driver: number; delta: number } | null {
  if (!state.linkingStartOffsets) {
    return null;
  }

  const candidates = procedure.deferredDrivers.flatMap((entry) => {
    const partialLink = procedure.partialLinks[entry.driver];
    if (!partialLink || procedure.completedDrivers.includes(entry.driver)) {
      return [];
    }

    return [-1, 1]
      .filter((delta) => canApplyLinkedDelta(state.linkingStartOffsets!, partialLink, delta))
      .map((delta) => ({
        driver: entry.driver,
        delta,
        changesDirection: delta !== procedure.lastTriedDeltas[entry.driver],
      }));
  });

  candidates.sort((left, right) => (
    Number(right.changesDirection) - Number(left.changesDirection)
    || Math.abs(state.linkingStartOffsets![right.driver]) - Math.abs(state.linkingStartOffsets![left.driver])
    || left.driver - right.driver
    || left.delta - right.delta
  ));

  return candidates[0] || null;
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
): { driver: number | null; delta?: number; procedure: PlateLinkingProcedureState } {
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
    && entry.blockedBy.every((blocker) => isBlockerResolved(blocker, state))
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

  const escapeProbe = findDeferredEscapeProbe(state, nextProcedure);
  if (escapeProbe) {
    return { ...escapeProbe, procedure: nextProcedure };
  }

  // The prompt guard will stop this fallback if it cannot change the procedure
  // state. It remains useful when an incomplete observation can still add data.
  return {
    driver: findFarthestPlate(
      state.offsets,
      nextProcedure.completedDrivers,
      currentDriver === undefined ? [] : [currentDriver],
    ) ?? findFarthestPlate(state.offsets, nextProcedure.completedDrivers),
    procedure: nextProcedure,
  };
}

function getPromptKey(
  state: AppStateData,
  procedure: PlateLinkingProcedureState,
  phase: "move" | "center" | "reset",
  driver: number,
  delta: number,
): string {
  return JSON.stringify({
    phase,
    driver,
    delta,
    offsets: state.offsets,
    links: state.links,
    completedDrivers: procedure.completedDrivers,
    pendingDrivers: procedure.pendingDrivers,
    deferredDrivers: procedure.deferredDrivers,
    partialLinks: procedure.partialLinks,
    lastTriedDeltas: procedure.lastTriedDeltas,
  });
}

function beginGuardedPrompt(
  state: AppStateData,
  procedure: PlateLinkingProcedureState,
  phase: "move" | "center" | "reset",
  driver: number,
  delta: number,
  isRecovery = false,
): AppStateData {
  const key = getPromptKey(state, procedure, phase, driver, delta);
  if ((procedure.seenPromptKeys || []).includes(key)) {
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
      solutionReturnState: state.solutionReturnState ?? returnState,
    };
    const solution = buildSolutionPlanForApp(solutionState, startOffsets);
    if (solution.moves !== null) {
      return {
        ...solutionState,
        solution,
      };
    }

    if (phase !== "reset") {
      const resetEscape = findResetEscapeProbe(state, procedure);
      if (resetEscape) {
        return beginGuardedPrompt(
          state,
          procedure,
          "reset",
          resetEscape.driver,
          resetEscape.delta,
          true,
        );
      }
    }

    return {
      ...state,
      mode: "linking",
      linkingPromptTask: createPlateLinkingStalledPromptTask(
        state,
        `The same ${phase} instruction for plate ${state.plateCount - driver} was reached twice. Use manual linking or go back and change an earlier observation.`,
      ),
      plateLinkingProcedure: procedure,
      solution: null,
    };
  }

  const nextProcedure = {
    ...procedure,
    seenPromptKeys: [...(procedure.seenPromptKeys || []), key],
  };
  return {
    ...state,
    mode: "linking",
    linkingPromptTask: phase === "center"
      ? createPlateLinkingCenterPromptTask(state, driver, delta, isRecovery)
      : phase === "reset"
        ? createPlateLinkingResetPromptTask(state, driver, delta)
        : createPlateLinkingPromptTask(state, driver, delta),
    plateLinkingProcedure: nextProcedure,
    solution: null,
  };
}

function beginNextPrompt(
  state: AppStateData,
  procedure: PlateLinkingProcedureState,
  currentDriver?: number,
  preferredDriver?: number | null,
): AppStateData {
  if (shouldProceedToSolution(state, procedure)) {
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
      solutionReturnState: state.solutionReturnState ?? returnState,
    };
    const solution = buildSolutionPlanForApp(solutionState, startOffsets);
    if (solution.moves !== null) {
      return {
        ...solutionState,
        solution,
      };
    }
  }

  if (
    typeof preferredDriver === "number"
    && preferredDriver >= 0
    && preferredDriver < state.plateCount
    && !procedure.completedDrivers.includes(preferredDriver)
  ) {
    const delta = getProbeDelta(
      state.offsets[preferredDriver],
      procedure.lastTriedDeltas[preferredDriver],
    );
    return beginGuardedPrompt(state, procedure, "move", preferredDriver, delta);
  }

  const recoveryMove = findKnownRecoveryMove(state, procedure);
  if (recoveryMove) {
    return beginGuardedPrompt(
      state,
      procedure,
      "center",
      recoveryMove.driver,
      recoveryMove.delta,
      true,
    );
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
      solutionReturnState: state.solutionReturnState ?? returnState,
    };
    return {
      ...solutionState,
      solution: buildSolutionPlanForApp(solutionState, startOffsets),
    };
  }

  const delta = selection.delta ?? getProbeDelta(
    state.offsets[selection.driver],
    selection.procedure.lastTriedDeltas[selection.driver],
  );
  return beginGuardedPrompt(state, selection.procedure, "move", selection.driver, delta);
}

function beginCenteringPromptOrNext(
  state: AppStateData,
  procedure: PlateLinkingProcedureState,
  completedDriver: number,
): AppStateData {
  if (shouldProceedToSolution(state, procedure)) {
    return beginNextPrompt(state, procedure, completedDriver);
  }

  const delta = getCenteringDelta(state, completedDriver);
  if (delta === null) {
    return beginNextPrompt(state, procedure, completedDriver);
  }

  return beginGuardedPrompt(state, procedure, "center", completedDriver, delta);
}

export function advancePlateLinkingCenterPrompt(state: AppStateData): AppStateData {
  const task = state.linkingPromptTask;
  const procedure = state.plateLinkingProcedure;
  const link = task ? state.links[task.driver] : null;
  if (state.mode !== "linking" || task?.phase !== "center" || !procedure || !link) {
    return state;
  }

  if (!canApplyLinkedDelta(state.offsets, link, task.delta)) {
    return beginNextPrompt(state, procedure, task.driver);
  }

  const nextState = pushProcedureHistory(
    {
      ...state,
      offsets: applyLinkedDelta(state.offsets, link, task.delta),
    },
    procedure,
  );

  return task.isRecovery
    ? beginNextPrompt(nextState, nextState.plateLinkingProcedure!, task.driver)
    : beginCenteringPromptOrNext(
        nextState,
        nextState.plateLinkingProcedure!,
        task.driver,
      );
}

export function advancePlateLinkingResetPrompt(state: AppStateData): AppStateData {
  const task = state.linkingPromptTask;
  const procedure = state.plateLinkingProcedure;
  if (
    state.mode !== "linking"
    || task?.phase !== "reset"
    || !procedure
    || !state.linkingStartOffsets
    || task.retryDriver === undefined
    || task.retryDelta === undefined
  ) {
    return state;
  }

  const nextState = pushProcedureHistory(
    {
      ...state,
      offsets: cloneOffsets(state.linkingStartOffsets),
    },
    procedure,
  );

  return beginGuardedPrompt(
    nextState,
    nextState.plateLinkingProcedure!,
    "move",
    task.retryDriver,
    task.retryDelta,
  );
}

export function startPlateLinkingProcedure(state: AppStateData): AppStateData {
  return startPlateLinkingProcedureFromDriver(state, null);
}

export function startPlateLinkingProcedureFromDriver(state: AppStateData, preferredDriver: number | null): AppStateData {
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
    undefined,
    preferredDriver,
  );
}

export function startFreshPlateLinkingProcedure(state: AppStateData): AppStateData {
  const linkingStartOffsets = cloneOffsets(state.offsets);
  return startPlateLinkingProcedureFromDriver({
    ...state,
    linkingStartOffsets,
    links: createEmptyLinks(state.plateCount),
    linkDeltas: createEmptyLinkDeltas(state.plateCount),
    linkingPromptTask: null,
    plateLinkingProcedure: null,
    solution: null,
  }, null);
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

  return beginCenteringPromptOrNext(
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
  const procedure = state.plateLinkingProcedure
    ? { ...state.plateLinkingProcedure, seenPromptKeys: [], history: [] }
    : createProcedureState(state);
  return beginNextPrompt(
    {
      ...state,
      offsets,
      plateLinkingProcedure: procedure,
    },
    procedure,
  );
}
