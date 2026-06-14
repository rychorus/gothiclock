import type { Direction, SolutionMoveData } from "./types";

export class SolutionMove implements SolutionMoveData {
  plate: number;
  delta: number;
  direction: Direction;

  constructor({ plate = 0, delta = 0, direction = "up" }: Partial<SolutionMoveData> = {}) {
    this.plate = plate;
    this.delta = delta;
    this.direction = direction;
  }
}
