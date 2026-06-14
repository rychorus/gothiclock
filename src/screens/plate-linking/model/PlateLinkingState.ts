import type { AppMode, DeferredLinkTask, LinkDeltas, LinkTask, Offsets, PlateLinks, SolutionPlanData, SolverSessionData } from "../../../lib/types";

/**
 * Shape reference for the app state passed into the plate-linking solver.
 *
 * The runtime still passes plain objects. This class exists so the contract is
 * explicit and the fields are easy to inspect while implementing a solver.
 */
export class PlateLinkingState {
  plateCount: number;
  offsets: Offsets;
  links: PlateLinks;
  linkDeltas: LinkDeltas;
  linkingStartOffsets: Offsets | null;
  mode: AppMode;
  currentTask: LinkTask | null;
  solution: SolutionPlanData | null;
  deferredLinkTasks: DeferredLinkTask[];
  linkTaskHistory: LinkTask[];
  customSolverSession: SolverSessionData | null;

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
  }: Partial<PlateLinkingState> = {}) {
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
