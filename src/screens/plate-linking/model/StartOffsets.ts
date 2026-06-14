/**
 * Shape reference for the starting offsets baseline.
 *
 * The runtime still passes a plain array. This class is a readable contract
 * for the solver input.
 */
export class StartOffsets {
  values;

  constructor(values = []) {
    this.values = values;
  }
}
