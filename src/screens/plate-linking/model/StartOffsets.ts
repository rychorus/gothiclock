import type { Offsets } from "./types";

export interface StartOffsetsData {
  values: Offsets;
}

/**
 * Shape reference for the starting offsets baseline.
 *
 * The runtime still passes a plain array. This class is a readable contract
 * for the solver input.
 */
export class StartOffsets implements StartOffsetsData {
  values: Offsets;

  constructor(values: Offsets = []) {
    this.values = values;
  }
}
