export const APP_VERSION = "v1.5.8";
export const MIN_PLATES = 3;
export const MAX_PLATES = 7;
export const HOLE_COUNT = 7;
export const CENTER_INDEX = 3;
export const START_COUNT = 5;
export const STORAGE_KEY = "gothic-lockpick.saved-locks";

export function createEmptyLinks(count) {
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

export function chooseNextDriver(state) {
  const unknownPlates = getUnknownPlates(state.links);
  if (!unknownPlates.length) {
    return null;
  }

  const unresolvedActivePlates = unknownPlates.filter((index) => state.offsets[index] !== 0);
  if (!unresolvedActivePlates.length) {
    return null;
  }

  return unresolvedActivePlates
    .map((index) => ({
      index,
      score: Math.abs(state.offsets[index]),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0].index;
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
    currentTask: null,
    solution: null,
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
  };
}
