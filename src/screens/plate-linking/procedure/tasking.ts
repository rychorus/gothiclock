import { cloneOffsets, createEmptyLinkDeltas, createEmptyLinks, createIdentityLink, chooseNextDriver, getSuggestedDelta } from "../../../lib/lockData";
import { buildSolutionPlanForApp } from "../implementation";
import { USE_CUSTOM_SOLUTION } from "../implementation/solutionMode";
import { finalizeSolverSession, withSolverInteraction } from "../implementation/custom/session";
import { cloneLinkTask, getSolutionStartOffsets, pruneDeferredLinkTasks, rebaseDeferredTask } from "./helpers";

function beginDeferredBlockedTask(state: any, blockedIndexes: number[], beginNextLinkTask: any) {
  const blockedBy = [...new Set(blockedIndexes.filter((index) => index !== state.currentTask.driver))].sort((a, b) => a - b);
  const blockedRequirements = blockedBy.map((index) => ({
    index,
    delta: state.currentTask.attempts?.[index] || 0,
  }));
  const currentDriver = state.currentTask.driver;
  const deferredTasks = pruneDeferredLinkTasks(state).filter((deferredTask) => deferredTask.driver !== currentDriver);

  deferredTasks.push({
    driver: currentDriver,
    blockedBy,
    blockedRequirements,
    task: cloneLinkTask(state.currentTask),
    offsets: cloneOffsets(state.offsets),
  });

  return beginNextLinkTask({
    ...state,
    currentTask: null,
    deferredLinkTasks: deferredTasks,
  }, {
    excludeDrivers: [currentDriver],
  });
}

function resumeDeferredBlockedTask(state: any, driver: number | null = null) {
  const deferredLinkTasks = pruneDeferredLinkTasks(state);
  if (!deferredLinkTasks.length) {
    return state;
  }

  const deferredIndex = driver === null
    ? deferredLinkTasks.length - 1
    : deferredLinkTasks.findIndex((deferredTask) => deferredTask.driver === driver);

  if (deferredIndex < 0) {
    return state;
  }

  const [deferredTask] = deferredLinkTasks.splice(deferredIndex, 1);
  const currentOffsets = cloneOffsets(state.offsets);
  const rebasedTask = rebaseDeferredTask(deferredTask.task, deferredTask.offsets, currentOffsets);

  return {
    ...state,
    deferredLinkTasks,
    offsets: currentOffsets,
    currentTask: {
      ...rebasedTask,
      wasDeferred: true,
      phase: "step1",
      startOffsets: cloneOffsets(currentOffsets),
      baseOffsets: null,
      attempts: Array.from({ length: state.plateCount }, () => 0),
    },
    mode: "linking",
  };
}

function startLinkTaskForDriver(state: any, driver: number) {
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

export function beginNextLinkTask(state: any, options: { excludeDrivers?: number[] } = {}) {
  const normalizedState = {
    ...state,
    deferredLinkTasks: pruneDeferredLinkTasks(state),
  };

  const driver = chooseNextDriver(normalizedState, options.excludeDrivers || []);

  if (driver === null || driver === undefined) {
    if (normalizedState.deferredLinkTasks.length) {
      return withSolverInteraction({
        ...normalizedState,
        mode: "linking",
        currentTask: null,
      }, { kind: "task_wait" });
    }

    const links = normalizedState.links.map((link, index) => link || createIdentityLink(normalizedState.plateCount, index));
    return withSolverInteraction(enterSolutionMode({ ...normalizedState, links }), { kind: "enter_solution" });
  }

  if (normalizedState.deferredLinkTasks.some((deferredTask) => deferredTask.driver === driver)) {
    return withSolverInteraction(resumeDeferredBlockedTask(normalizedState, driver), { kind: "resume_task", plateIndex: driver });
  }

  return withSolverInteraction(startLinkTaskForDriver(normalizedState, driver), { kind: "begin_task", plateIndex: driver });
}

export function enterSolutionMode(state) {
  const startOffsets = getSolutionStartOffsets(state);
  const nextState = {
    ...state,
    deferredLinkTasks: [],
    mode: "solution",
    currentTask: null,
    offsets: cloneOffsets(startOffsets),
  };

  if (USE_CUSTOM_SOLUTION) {
    return finalizeSolverSession(withSolverInteraction({
      ...nextState,
      solution: buildSolutionPlanForApp(nextState, startOffsets),
    }, { kind: "enter_solution" }));
  }

  return {
    ...nextState,
    solution: buildSolutionPlanForApp(nextState, startOffsets),
  };
}
