import type { PlateLinkingPrompt, PlateLinkingPromptTask } from "./types";

export function createPlateLinkingPrompt(task: PlateLinkingPromptTask, plateCount: number): PlateLinkingPrompt {
  const plateNumber = plateCount - task.driver;

  if (task.phase === "observe") {
    return {
      kind: "observe",
      message: `What moved with plate ${plateNumber}?`,
      hint: "Move each plate that followed the prompted plate, then continue.",
      plateIndex: task.driver,
      direction: task.direction,
    };
  }

  if (task.phase === "complete") {
    return {
      kind: "complete",
      message: `Observation captured for plate ${plateNumber}.`,
      hint: "New plate-linking logic can consume this observation here.",
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
