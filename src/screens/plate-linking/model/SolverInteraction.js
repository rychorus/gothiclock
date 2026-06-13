/**
 * A single solver-relevant user interaction.
 *
 * The custom solver stores these entries so its logic can inspect the exact
 * sequence of plate moves, clicks, and confirmations the user performed.
 */
export class SolverInteraction {
  constructor({
    kind = "unknown",
    plateIndex = null,
    direction = null,
    offset = null,
    phase = null,
    details = null,
    timestamp = Date.now(),
  } = {}) {
    this.kind = kind;
    this.plateIndex = plateIndex;
    this.direction = direction;
    this.offset = offset;
    this.phase = phase;
    this.details = details;
    this.timestamp = timestamp;
  }
}
