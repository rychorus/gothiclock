import type { PlateLinkingPrompt, PlateLinkingPromptTask } from "./types";

export function createPlateLinkingPrompt(task: PlateLinkingPromptTask, plateCount: number): PlateLinkingPrompt {
  const plateNumber = plateCount - task.driver;

  if (task.phase === "stalled") {
    return {
      kind: "stalled",
      message: "Guided linking could not find a move that makes progress",
      hint: task.stalledReason || "Go back and adjust the setup, or continue with manual linking.",
      plateIndex: task.driver,
      direction: task.direction,
    };
  }

  if (task.phase === "reset") {
    return {
      kind: "reset",
      message: "Press Reset to restore the starting positions",
      hint: `Your learned links are kept. Plate ${plateNumber} will then be retried from the original setup.`,
      plateIndex: task.driver,
      direction: task.direction,
    };
  }

  if (task.phase === "observe") {
    return {
      kind: "observe",
      message: `What moved with plate ${plateNumber}?`,
      hint: "Move each plate that followed it. If one was blocked at an edge, press outward on that plate.",
      plateIndex: task.driver,
      direction: task.direction,
    };
  }

  if (task.phase === "center") {
    const direction = task.direction === "up" ? "left" : "right";
    return {
      kind: "center",
      message: `Move plate ${plateNumber} ${direction}`,
      hint: "This puts that plate and the plates linked to it closer to center.",
      plateIndex: task.driver,
      direction: task.direction,
    };
  }

  const direction = task.direction === "up" ? "left" : "right";
  return {
    kind: "move",
    message: `Move plate ${plateNumber} ${direction}`,
    hint: "Perform the prompted move, then continue.",
    plateIndex: task.driver,
    direction: task.direction,
  };
}
