import type { Offsets } from "./types";
import type { SolutionChunkData } from "./SolutionChunk";
import type { SolutionMoveData } from "./SolutionMove";

export interface SolutionPlanData {
  moves: SolutionMoveData[] | null;
  chunks: SolutionChunkData[];
  index: number;
  startOffsets: Offsets;
}

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
