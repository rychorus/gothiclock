import { cloneOffsets, createEmptyLinkDeltas, createEmptyLinks, createIdentityLink, chooseNextDriver, getSuggestedDelta } from "../../../lib/lockData";
import type { AppStateData, DeferredLinkTask, LinkTask, Offsets } from "../../../lib/types";
import { buildSolutionPlanForApp } from "../implementation";
import { USE_CUSTOM_SOLUTION } from "../implementation/solutionMode";
import { finalizeSolverSession, withSolverInteraction } from "../implementation/custom/session";
import { cloneLinkTask, getSolutionStartOffsets, pruneDeferredLinkTasks, rebaseDeferredTask } from "./helpers";

function beginDeferredBlockedTask(state: AppStateData, blockedIndexes: number[], beginNextLinkTask: (nextState: AppStateData, options?: { excludeDrivers?: number[] }) => AppStateData) {
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
  } as AppStateData, {
    excludeDrivers: [currentDriver],
  });
}

function resumeDeferredBlockedTask(state: AppStateData, driver: number | null = null): AppStateData {
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
  if (!rebasedTask) {
    return state;
  }

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
  } as AppStateData;
}

function startLinkTaskForDriver(state: AppStateData, driver: number): AppStateData {
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
  } as AppStateData;
}

export function beginNextLinkTask(state: AppStateData, options: { excludeDrivers?: number[] } = {}): AppStateData {
  const normalizedState: AppStateData = {
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
      } as AppStateData, { kind: "task_wait" });
    }

    const links = normalizedState.links.map((link, index) => link || createIdentityLink(normalizedState.plateCount, index));
    return withSolverInteraction(enterSolutionMode({ ...normalizedState, links } as AppStateData), { kind: "enter_solution" });
  }

  if (normalizedState.deferredLinkTasks.some((deferredTask) => deferredTask.driver === driver)) {
    return withSolverInteraction(resumeDeferredBlockedTask(normalizedState, driver), { kind: "resume_task", plateIndex: driver });
  }

  return withSolverInteraction(startLinkTaskForDriver(normalizedState, driver), { kind: "begin_task", plateIndex: driver });
}

export function enterSolutionMode(state: AppStateData): AppStateData {
  const startOffsets = getSolutionStartOffsets(state);
  const nextState: AppStateData = {
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
    } as AppStateData, { kind: "enter_solution" }));
  }

  return {
    ...nextState,
    solution: buildSolutionPlanForApp(nextState, startOffsets),
  };
}
