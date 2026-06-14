/**
 * Human-readable guidance for the next solver interaction.
 *
 * This is the prompt the UI can display while the session is waiting for the
 * next plate move, click, or confirmation step.
 */
import type { Direction, SolverPromptData } from "../../../lib/types";

export class SolverPrompt implements SolverPromptData {
  kind: "idle" | "move" | "observe" | "complete";
  message: string;
  plateIndex: number | null;
  direction: Direction | null;
  hint: string;

  constructor({
    kind = "idle",
    message = "",
    plateIndex = null,
    direction = null,
    hint = "",
  }: Partial<SolverPromptData> = {}) {
    this.kind = kind;
    this.message = message;
    this.plateIndex = plateIndex;
    this.direction = direction;
    this.hint = hint;
  }
}
