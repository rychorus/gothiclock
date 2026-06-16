import type { PlateLinkingPrompt, PlateLinkingPromptTask } from "./types";

export function createPlateLinkingPrompt(task: PlateLinkingPromptTask, plateCount: number): PlateLinkingPrompt {
  const plateNumber = plateCount - task.driver;

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
