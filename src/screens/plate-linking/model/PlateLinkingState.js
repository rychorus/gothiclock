/**
 * Shape reference for the app state passed into the plate-linking solver.
 *
 * The runtime still passes plain objects. This class exists so the contract is
 * explicit and the fields are easy to inspect while implementing a solver.
 */
export class PlateLinkingState {
  constructor({
    plateCount = 0,
    offsets = [],
    links = [],
    linkDeltas = [],
    linkingStartOffsets = null,
    mode = "menu",
    currentTask = null,
    solution = null,
    deferredLinkTasks = [],
    linkTaskHistory = [],
    customSolverSession = null,
  } = {}) {
    this.plateCount = plateCount;
    this.offsets = offsets;
    this.links = links;
    this.linkDeltas = linkDeltas;
    this.linkingStartOffsets = linkingStartOffsets;
    this.mode = mode;
    this.currentTask = currentTask;
    this.solution = solution;
    this.deferredLinkTasks = deferredLinkTasks;
    this.linkTaskHistory = linkTaskHistory;
    this.customSolverSession = customSolverSession;
  }
}
