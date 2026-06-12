export const APP_VERSION = "v1.5.34";
export const MIN_PLATES = 3;
export const MAX_PLATES = 7;
export const HOLE_COUNT = 7;
export const CENTER_INDEX = 3;
export const START_COUNT = 5;
export const STORAGE_KEY = "gothic-lockpick.saved-locks";

export function createEmptyLinks(count) {
  return Array.from({ length: count }, () => null);
}

export function createEmptyLinkDeltas(count) {
  return Array.from({ length: count }, () => null);
}

export function createIdentityLink(count, driverIndex) {
  return Array.from({ length: count }, (_, index) => (index === driverIndex ? 1 : 0));
}

export function cloneOffsets(offsets) {
  return [...offsets];
}

export function resizeOffsets(offsets, count) {
  return Array.from({ length: count }, (_, index) => offsets?.[index] ?? 0);
}

export function resizeLink(link, count) {
  if (!link) {
    return null;
  }

  return Array.from({ length: count }, (_, index) => link[index] ?? 0);
}

export function resizeLinkDeltas(linkDeltas, count) {
  return Array.from({ length: count }, (_, index) => linkDeltas?.[index] ?? null);
}

export function clampOffset(offset) {
  return Math.max(-CENTER_INDEX, Math.min(CENTER_INDEX, offset));
}

export function createLockId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getUnknownPlates(links) {
  return links
    .map((link, index) => ({ index, known: Boolean(link) }))
    .filter(({ known }) => !known)
    .map(({ index }) => index);
}

export function areUnknownPlatesCentered(state) {
  const unknownPlates = getUnknownPlates(state.links);
  return unknownPlates.length > 0 && unknownPlates.every((index) => state.offsets[index] === 0);
}

function getDeferredRequirements(deferredTask) {
  if (Array.isArray(deferredTask.blockedRequirements) && deferredTask.blockedRequirements.length) {
    return deferredTask.blockedRequirements;
  }

  return (deferredTask.blockedBy || []).map((index) => ({
    index,
    delta: deferredTask.task?.attempts?.[index] || 0,
  }));
}

function isDeferredBlockerActive(state, deferredTask, index, unknownSet) {
  if (unknownSet.has(index)) {
    return true;
  }

  const requirement = getDeferredRequirements(deferredTask).find((entry) => entry.index === index);
  const requiredDelta = requirement?.delta || 0;
  if (!requiredDelta) {
    return false;
  }

  const nextOffset = (state.offsets?.[index] ?? 0) + requiredDelta;
  return nextOffset < -CENTER_INDEX || nextOffset > CENTER_INDEX;
}

function getDeferredDependencySet(state, unknownPlates) {
  const unknownSet = new Set(unknownPlates);
  const deferredSet = new Set();

  for (const deferredTask of state.deferredLinkTasks || []) {
    const blockers = (deferredTask.blockedBy || []).filter((index) => isDeferredBlockerActive(state, deferredTask, index, unknownSet));
    if (!blockers.length) {
      continue;
    }

    deferredSet.add(deferredTask.driver);
    blockers.forEach((index) => deferredSet.add(index));
  }

  return deferredSet;
}

function getReadyDeferredDrivers(state, excludedDrivers = []) {
  const excludedSet = new Set(excludedDrivers);
  const unknownSet = new Set(getUnknownPlates(state.links));

  return (state.deferredLinkTasks || [])
    .filter((deferredTask) => {
      if (excludedSet.has(deferredTask.driver)) {
        return false;
      }

      return (deferredTask.blockedBy || []).every((index) => !isDeferredBlockerActive(state, deferredTask, index, unknownSet));
    })
    .map((deferredTask) => deferredTask.driver);
}

function buildKnownLinkAdjacency(links) {
  const adjacency = new Map();

  links.forEach((link, source) => {
    if (!link) {
      return;
    }

    link.forEach((value, target) => {
      if (!value || source === target) {
        return;
      }

      if (!adjacency.has(source)) {
        adjacency.set(source, []);
      }
      if (!adjacency.has(target)) {
        adjacency.set(target, []);
      }

      // Linked plates move as a coupled group, so a discovered relation
      // is useful in both directions for future driver selection.
      adjacency.get(source).push({ index: target, sign: value });
      adjacency.get(target).push({ index: source, sign: value });
    });
  });

  return adjacency;
}

function getKnownBlockedSet(state, candidatePlates) {
  const adjacency = buildKnownLinkAdjacency(state.links);
  const blockedSet = new Set();

  candidatePlates.forEach((driver) => {
    const delta = getSuggestedDelta(state.offsets[driver]);
    const relations = new Map([[driver, 1]]);
    const queue = [driver];

    while (queue.length) {
      const current = queue.shift();

      for (const edge of adjacency.get(current) || []) {
        const nextRelation = relations.get(current) * edge.sign;
        if (relations.has(edge.index)) {
          continue;
        }

        relations.set(edge.index, nextRelation);
        queue.push(edge.index);
      }
    }

    const isBlocked = [...relations.entries()].some(([index, relation]) => {
      const nextOffset = state.offsets[index] + (relation * delta);
      return nextOffset < -CENTER_INDEX || nextOffset > CENTER_INDEX;
    });

    if (isBlocked) {
      blockedSet.add(driver);
    }
  });

  return blockedSet;
}

export function chooseNextDriver(state, excludedDrivers = []) {
  const readyDeferredDrivers = getReadyDeferredDrivers(state, excludedDrivers);
  if (readyDeferredDrivers.length) {
    return readyDeferredDrivers
      .map((index) => ({
        index,
        score: Math.abs(state.offsets[index]),
      }))
      .sort((a, b) => b.score - a.score || b.index - a.index)[0].index;
  }

  const unknownPlates = getUnknownPlates(state.links);
  if (!unknownPlates.length) {
    return null;
  }

  const excludedSet = new Set(excludedDrivers);
  const deferredDependencySet = getDeferredDependencySet(state, unknownPlates);
  const selectableUnknownPlates = unknownPlates.filter((index) => !excludedSet.has(index));
  if (!selectableUnknownPlates.length) {
    return null;
  }

  const unresolvedActivePlates = selectableUnknownPlates.filter((index) => state.offsets[index] !== 0);
  const preferredActivePlates = unresolvedActivePlates.filter((index) => !deferredDependencySet.has(index));
  const activePool = preferredActivePlates.length ? preferredActivePlates : unresolvedActivePlates;
  const blockedByKnownLinks = getKnownBlockedSet(state, activePool);
  const unblockedActivePlates = activePool.filter((index) => !blockedByKnownLinks.has(index));

  const unexploredFallbackPlates = selectableUnknownPlates.filter((index) => (
    state.offsets[index] === 0
    && !deferredDependencySet.has(index)
  ));

  const selectablePlates = unblockedActivePlates.length
    ? unblockedActivePlates
    : (unexploredFallbackPlates.length
      ? unexploredFallbackPlates
      : (activePool.length ? activePool : selectableUnknownPlates));

  return selectablePlates
    .map((index) => ({
      index,
      score: Math.abs(state.offsets[index]),
    }))
    .sort((a, b) => b.score - a.score || b.index - a.index)[0].index;
}

export function getSuggestedDelta(offset) {
  if (offset < 0) {
    return 1;
  }

  if (offset > 0) {
    return -1;
  }

  return -1;
}

export function createInitialAppState() {
  return {
    plateCount: START_COUNT,
    offsets: Array.from({ length: START_COUNT }, () => 0),
    mode: "menu",
    linkingStartOffsets: null,
    links: createEmptyLinks(START_COUNT),
    linkDeltas: createEmptyLinkDeltas(START_COUNT),
    testingFeedback: null,
    currentTask: null,
    solution: null,
    deferredLinkTasks: [],
    linkTaskHistory: [],
    currentSaveId: null,
    snapshotsByCount: {},
  };
}

export function isTrivialCenteredLock(state) {
  return Boolean(state.linkingStartOffsets)
    && state.linkingStartOffsets.every((offset) => offset === 0)
    && state.offsets.every((offset) => offset === 0)
    && state.links.every((link) => !link)
    && Array.isArray(state.solution?.moves)
    && state.solution.moves.length === 0;
}

export function buildSavedLockRecord(state, { id, name, isDraft }) {
  return {
    id,
    name,
    isDraft,
    savedAt: new Date().toISOString(),
    plateCount: state.plateCount,
    mode: state.mode,
    linkingStartOffsets: state.linkingStartOffsets ? cloneOffsets(state.linkingStartOffsets) : null,
    currentOffsets: cloneOffsets(state.offsets),
    links: state.links.map((link) => resizeLink(link, state.plateCount)),
    linkDeltas: resizeLinkDeltas(state.linkDeltas, state.plateCount),
  };
}
