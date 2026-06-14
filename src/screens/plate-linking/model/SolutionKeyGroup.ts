export class SolutionKeyGroup {
  key;
  count;

  constructor({ key = "", count = 1 } = {}) {
    this.key = key;
    this.count = count;
  }
}
