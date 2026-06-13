export class SolutionChunk {
  constructor({
    id = "",
    type = "move",
    label = "",
    keys = [],
    keyGroups = [],
    offsets = [],
    move = null,
  } = {}) {
    this.id = id;
    this.type = type;
    this.label = label;
    this.keys = keys;
    this.keyGroups = keyGroups;
    this.offsets = offsets;
    this.move = move;
  }
}
