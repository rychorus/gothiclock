export class SolutionPlan {
  constructor({
    moves = null,
    chunks = [],
    index = 0,
    startOffsets = [],
  } = {}) {
    this.moves = moves;
    this.chunks = chunks;
    this.index = index;
    this.startOffsets = startOffsets;
  }
}
