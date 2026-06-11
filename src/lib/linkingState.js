import {
  clampOffset,
  cloneOffsets,
  createEmptyLinks,
  createIdentityLink,
  chooseNextDriver,
  getSuggestedDelta,
  getUnknownPlates,
} from "./lockData";
import { buildSolutionPlan } from "./solution";

function getSolutionStartOffsets(state) {
  return cloneOffsets(state.linkingStartOffsets || state.offsets);
}

function startLinkTaskForDriver(state, driver) {
  const delta = getSuggestedDelta(state.offsets[driver]);

  return {
    ...state,
    currentTask: {
      phase: "step1",
      driver,
      delta,
      direction: delta === -1 ? "up" : "down",
      startOffsets: cloneOffsets(state.offsets),
    },
  };
}

export function beginNextLinkTask(state) {
  const driver = chooseNextDriver(state);

  if (driver === null || driver === undefined) {
    const links = state.links.map((link, index) => link || createIdentityLink(state.plateCount, index));
    return enterSolutionMode({ ...state, links });
  }

  return startLinkTaskForDriver(state, driver);
}

export function startLinkingMode(state) {
  const isAligned = state.offsets.every((offset) => offset === 0);

  if (isAligned) {
    const nextState = {
      ...state,
      mode: "solution",
      links: createEmptyLinks(state.plateCount),
      linkingStartOffsets: cloneOffsets(state.offsets),
      currentTask: null,
    };

    return {
      ...nextState,
      solution: buildSolutionPlan(nextState, cloneOffsets(state.offsets)),
    };
  }

  return beginNextLinkTask({
    ...state,
    mode: "linking",
    links: createEmptyLinks(state.plateCount),
    linkingStartOffsets: cloneOffsets(state.offsets),
    solution: null,
  });
}

export function stepBackLinking(state) {
  if (state.mode !== "linking" || !state.currentTask) {
    return state;
  }

  if (state.currentTask.phase === "step2") {
    return {
      ...state,
      offsets: cloneOffsets(state.currentTask.baseOffsets),
      currentTask: {
        ...state.currentTask,
        phase: "step1",
        startOffsets: cloneOffsets(state.currentTask.startOffsets),
      },
    };
  }

  const previousKnownIndex = [...state.links]
    .map((link, index) => ({ link, index }))
    .reverse()
    .find(({ link }) => Boolean(link))
    ?.index;

  if (previousKnownIndex === undefined) {
    return {
      ...state,
      offsets: cloneOffsets(state.linkingStartOffsets || state.offsets),
      links: createEmptyLinks(state.plateCount),
      currentTask: null,
      mode: "setup",
    };
  }

  const links = [...state.links];
  links[previousKnownIndex] = null;
  let offsets = cloneOffsets(state.linkingStartOffsets || state.offsets);

  for (let index = 0; index < links.length; index += 1) {
    if (!links[index]) {
      continue;
    }

    const normalizedLink = links[index];
    const delta = normalizedLink[index] === 1
      ? (normalizedLink.some((value, linkIndex) => linkIndex !== index && value === -1) ? 1 : -1)
      : -1;
    const change = normalizedLink.map((value) => value * delta);
    offsets = offsets.map((value, offsetIndex) => value + change[offsetIndex]);
  }

  return beginNextLinkTask({
    ...state,
    links,
    offsets,
  });
}

export function resetPlates(state) {
  if (!state.linkingStartOffsets || state.mode === "solution" || state.mode === "ready_to_solve") {
    return state;
  }

  const nextState = {
    ...state,
    offsets: cloneOffsets(state.linkingStartOffsets),
  };

  return state.mode === "linking" ? beginNextLinkTask(nextState) : nextState;
}

export function advanceFromStep1(state) {
  if (!state.currentTask || state.currentTask.phase !== "step1") {
    return state;
  }

  const { driver, delta, startOffsets } = state.currentTask;
  const offsets = cloneOffsets(state.offsets);
  offsets[driver] = clampOffset(startOffsets[driver] + delta);

  return {
    ...state,
    offsets,
    currentTask: {
      ...state.currentTask,
      phase: "step2",
      baseOffsets: cloneOffsets(offsets),
      attempts: Array.from({ length: state.plateCount }, () => 0),
    },
  };
}

export function finishLinkCapture(state) {
  if (!state.currentTask || state.currentTask.phase !== "step2") {
    return state;
  }

  const { driver, delta, baseOffsets, attempts = [] } = state.currentTask;
  const normalizedLink = state.offsets.map((offset, index) => {
    if (index === driver) {
      return 1;
    }

    const actualDelta = offset - baseOffsets[index];
    const observedDelta = actualDelta !== 0 ? actualDelta : attempts[index] || 0;
    return Math.round(observedDelta / delta);
  });

  const links = [...state.links];
  links[driver] = normalizedLink;
  const nextState = { ...state, links };

  if (getUnknownPlates(links).length === 0) {
    return {
      ...nextState,
      mode: "ready_to_solve",
      currentTask: null,
      solution: buildSolutionPlan(nextState, getSolutionStartOffsets(nextState)),
    };
  }

  return beginNextLinkTask(nextState);
}

export function enterSolutionMode(state) {
  const startOffsets = getSolutionStartOffsets(state);
  const nextState = {
    ...state,
    mode: "solution",
    currentTask: null,
    offsets: cloneOffsets(startOffsets),
  };

  return {
    ...nextState,
    solution: buildSolutionPlan(nextState, startOffsets),
  };
}

export function updatePlateOffset(state, index, nextOffset, attemptedDirection = 0) {
  const offsets = cloneOffsets(state.offsets);
  offsets[index] = nextOffset;
  const nextState = { ...state, offsets };

  if (state.mode === "linking" && state.currentTask?.phase === "step2" && index !== state.currentTask.driver) {
    const attempts = [...state.currentTask.attempts];
    attempts[index] = attemptedDirection;
    nextState.currentTask = {
      ...state.currentTask,
      attempts,
    };
  }

  return nextState;
}

export function recordPlateAttempt(state, index, attemptedDirection) {
  if (state.mode !== "linking" || state.currentTask?.phase !== "step2" || index === state.currentTask.driver) {
    return state;
  }

  const attempts = [...state.currentTask.attempts];
  attempts[index] = attemptedDirection;
  return {
    ...state,
    currentTask: {
      ...state.currentTask,
      attempts,
    },
  };
}
