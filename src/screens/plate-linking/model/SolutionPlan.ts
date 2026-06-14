import type { Offsets, SolutionChunkData, SolutionMoveData, SolutionPlanData } from "../../../lib/types";

export class SolutionPlan implements SolutionPlanData {
  moves: SolutionMoveData[] | null;
  chunks: SolutionChunkData[];
  index: number;
  startOffsets: Offsets;

  constructor({
    moves = null,
    chunks = [],
    index = 0,
    startOffsets = [],
  }: Partial<SolutionPlanData> = {}) {
    this.moves = moves;
    this.chunks = chunks;
    this.index = index;
    this.startOffsets = startOffsets;
  }
}
