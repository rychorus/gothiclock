export function getHeroTitle(mode) {
  if (mode === "linking") {
    return "Plates Linking";
  }

  if (mode === "setup") {
    return "Plates Setup";
  }

  if (mode === "testing") {
    return "Testing Mode";
  }

  if (mode === "solution" || mode === "ready_to_solve") {
    return "Solution";
  }

  if (mode === "import") {
    return "Import Notation";
  }

  if (mode === "load") {
    return "Load Lock";
  }

  return null;
}

export function getStageInstruction(appState) {
  if (appState.mode === "linking" && appState.currentTask) {
    const driverIndex = appState.currentTask.driver ?? 0;
    const driver = appState.plateCount - driverIndex;
    const direction = appState.currentTask.direction === "up" ? "left" : "right";
    return appState.currentTask.phase === "step2" ? `What moved with plate ${driver}?` : `Move plate ${driver} ${direction}`;
  }

  return "";
}
