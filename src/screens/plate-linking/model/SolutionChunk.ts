import type { Offsets, SolutionKeyGroupData, SolutionMoveData } from "./types";

export class SolutionChunk {
  id: string;
  type: "reset" | "move" | "solved";
  label: string;
  keys: string[];
  keyGroups: SolutionKeyGroupData[];
  offsets: Offsets;
  move: SolutionMoveData | null;

  constructor({
    id = "",
    type = "move",
    label = "",
    keys = [],
    keyGroups = [],
    offsets = [],
    move = null,
  }: Partial<SolutionChunk> = {}) {
    this.id = id;
    this.type = type;
    this.label = label;
    this.keys = keys;
    this.keyGroups = keyGroups;
    this.offsets = offsets;
    this.move = move;
  }
}
