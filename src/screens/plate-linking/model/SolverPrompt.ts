/**
 * Human-readable guidance for the next solver interaction.
 *
 * This is the prompt the UI can display while the session is waiting for the
 * next plate move, click, or confirmation step.
 */
export class SolverPrompt {
  kind;
  message;
  plateIndex;
  direction;
  hint;

  constructor({
    kind = "idle",
    message = "",
    plateIndex = null,
    direction = null,
    hint = "",
  } = {}) {
    this.kind = kind;
    this.message = message;
    this.plateIndex = plateIndex;
    this.direction = direction;
    this.hint = hint;
  }
}
