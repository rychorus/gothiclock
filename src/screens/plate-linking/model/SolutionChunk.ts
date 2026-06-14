import type { Offsets } from "./types";
import type { SolutionKeyGroupData } from "./SolutionKeyGroup";
import type { SolutionMoveData } from "./SolutionMove";

export interface SolutionChunkData {
  id: string;
  type: "reset" | "move" | "solved";
  label: string;
  keys: string[];
  keyGroups: SolutionKeyGroupData[];
  offsets: Offsets;
  move: SolutionMoveData | null;
}

export class SolutionChunk implements SolutionChunkData {
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
