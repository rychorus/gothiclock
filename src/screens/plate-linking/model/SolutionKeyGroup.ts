export interface SolutionKeyGroupData {
  key: string;
  count: number;
}

export class SolutionKeyGroup implements SolutionKeyGroupData {
  key: string;
  count: number;

  constructor({ key = "", count = 1 } = {}) {
    this.key = key;
    this.count = count;
  }
}
