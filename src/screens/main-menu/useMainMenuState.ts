import { buildSolutionPlanForApp } from "../../lib/solution";
import { createEmptyLinkDeltas, createInitialAppState } from "../../lib/lockData";
import { parseNotationString } from "../../lib/notation";
import { enterSolutionMode } from "../../lib/appState";
import { startPlateLinkingProcedure } from "../plate-linking/procedure/plateLinkingProcedure";
import { parseImportedNotationInput } from "../shared/shareUrl";
import type { AppStateData, SharedLinkMetadata } from "../../lib/types";
import type { Dispatch, SetStateAction } from "react";

export function useMainMenuState({ setAppState, openLoadScreen, openImportScreen }: {
  setAppState: Dispatch<SetStateAction<AppStateData>>;
  openLoadScreen: () => void;
  openImportScreen: () => void;
}) {
  function applyNotationText(text: string, { showSolution = false, sharedLinkMetadata = null }: { showSolution?: boolean; sharedLinkMetadata?: SharedLinkMetadata | null } = {}) {
    const imported = parseImportedNotationInput(text);
    const parsed = parseNotationString(imported.notation);
    const hasLinks = parsed.links.some(Boolean);
    const allLinksKnown = parsed.links.every(Boolean);
    const nextSharedLinkMetadata = sharedLinkMetadata ?? (
      imported.notation === text
        ? null
        : {
            name: imported.name || "",
            description: imported.description || "",
          }
    );
    const baseState: AppStateData = {
      ...createInitialAppState(),
      plateCount: parsed.plateCount,
      offsets: parsed.offsets,
      links: parsed.links,
      linkDeltas: createEmptyLinkDeltas(parsed.plateCount),
      linkingStartOffsets: parsed.offsets,
      linkingPromptTask: null,
      plateLinkingProcedure: null,
      currentSaveId: null,
      sharedLinkMetadata: nextSharedLinkMetadata,
      snapshotsByCount: {},
      mode: hasLinks ? "linking" : "setup",
    };

    if (!hasLinks) {
      setAppState(() => baseState);
      return;
    }

    if (allLinksKnown) {
      if (showSolution) {
        setAppState(() => enterSolutionMode(baseState, {
          returnState: nextSharedLinkMetadata ? createInitialAppState() : undefined,
        }));
        return;
      }

      setAppState(() => ({
        ...baseState,
        mode: "ready_to_solve",
        solution: buildSolutionPlanForApp(baseState, parsed.offsets),
      }));
      return;
    }

    setAppState(() => startPlateLinkingProcedure({
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
