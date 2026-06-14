import type { SolutionKeyGroupData } from "./types";

export class SolutionKeyGroup {
  key: string;
  count: number;

  constructor({ key = "", count = 1 } = {}) {
    this.key = key;
    this.count = count;
  }
}
