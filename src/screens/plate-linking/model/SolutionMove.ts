export class SolutionMove {
  plate;
  delta;
  direction;

  constructor({ plate = 0, delta = 0, direction = "up" } = {}) {
    this.plate = plate;
    this.delta = delta;
    this.direction = direction;
  }
}
