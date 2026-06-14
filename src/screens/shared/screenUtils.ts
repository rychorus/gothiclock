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
