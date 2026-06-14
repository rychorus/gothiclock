/**
 * A single solver-relevant user interaction.
 *
 * The custom solver stores these entries so its logic can inspect the exact
 * sequence of plate moves, clicks, and confirmations the user performed.
 */
import type { Direction, SolverInteractionData } from "../../../lib/types";

export class SolverInteraction implements SolverInteractionData {
  kind: string;
  plateIndex: number | null;
  direction: Direction | null;
  offset: number | null;
  phase: string | null;
  details: Record<string, unknown> | null;
  timestamp: number;

  constructor({
    kind = "unknown",
    plateIndex = null,
    direction = null,
    offset = null,
    phase = null,
    details = null,
    timestamp = Date.now(),
  }: Partial<SolverInteractionData> = {}) {
    this.kind = kind;
    this.plateIndex = plateIndex;
    this.direction = direction;
    this.offset = offset;
    this.phase = phase;
    this.details = details;
    this.timestamp = timestamp;
  }
}
