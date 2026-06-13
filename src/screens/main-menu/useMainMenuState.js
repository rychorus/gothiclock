import { buildSolutionPlan } from "../../lib/solution";
import { createEmptyLinkDeltas, createInitialAppState } from "../../lib/lockData";
import { parseNotationString } from "../../lib/notation";
import { beginNextLinkTask, enterSolutionMode } from "../plate-linking/linkingState";

export function useMainMenuState({ setAppState, openLoadScreen, openImportScreen }) {
  function applyNotationText(text, { showSolution = false } = {}) {
    const parsed = parseNotationString(text);
    const hasLinks = parsed.links.some(Boolean);
    const allLinksKnown = parsed.links.every(Boolean);
    const baseState = {
      ...createInitialAppState(),
      plateCount: parsed.plateCount,
      offsets: parsed.offsets,
      links: parsed.links,
      linkDeltas: createEmptyLinkDeltas(parsed.plateCount),
      linkingStartOffsets: parsed.offsets,
      currentTask: null,
      currentSaveId: null,
      snapshotsByCount: {},
      deferredLinkTasks: [],
      mode: hasLinks ? "linking" : "setup",
    };

    if (!hasLinks) {
      setAppState(() => baseState);
      return;
    }

    if (allLinksKnown) {
      if (showSolution) {
        setAppState(() => enterSolutionMode(baseState));
        return;
      }

      setAppState(() => ({
        ...baseState,
        mode: "ready_to_solve",
        solution: buildSolutionPlan(baseState, parsed.offsets),
      }));
      return;
    }

    setAppState(() => beginNextLinkTask({
      ...baseState,
      solution: null,
    }));
  }

  return {
    openLoadLockDialog: openLoadScreen,
    openImportNotationDialog: openImportScreen,
    importNotation: applyNotationText,
  };
}
