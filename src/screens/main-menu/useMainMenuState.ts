import { buildSolutionPlanForApp } from "../../lib/solution";
import { buildSavedLockRecord, createEmptyLinkDeltas, createInitialAppState, createLockId } from "../../lib/lockData";
import { parseNotationString } from "../../lib/notation";
import { enterSolutionMode } from "../../lib/appState";
import { getDefaultLockName, upsertSavedLock } from "../../lib/lockStorage";
import { startPlateLinkingProcedure } from "../plate-linking/procedure/plateLinkingProcedure";
import { extractImportedShareUrls, parseImportedNotationInput } from "../shared/shareUrl";
import type { AppStateData, SharedLinkMetadata } from "../../lib/types";
import type { Dispatch, SetStateAction } from "react";

export function useMainMenuState({ setAppState, openLoadScreen, openImportScreen }: {
  setAppState: Dispatch<SetStateAction<AppStateData>>;
  openLoadScreen: () => void;
  openImportScreen: () => void;
}) {
  function applyNotationText(text: string, { showSolution = false, sharedLinkMetadata = null }: { showSolution?: boolean; sharedLinkMetadata?: SharedLinkMetadata | null } = {}) {
    const importedShareUrls = extractImportedShareUrls(text);
    if (importedShareUrls.length > 1) {
      importedShareUrls.forEach((sharedUrl) => {
        const parsed = parseNotationString(sharedUrl.notation);
        const hasLinks = parsed.links.some(Boolean);
        const allLinksKnown = parsed.links.every(Boolean);
        const importedState: AppStateData = {
          ...createInitialAppState(),
          plateCount: parsed.plateCount,
          offsets: parsed.offsets,
          links: parsed.links,
          linkDeltas: createEmptyLinkDeltas(parsed.plateCount),
          linkingStartOffsets: parsed.offsets,
          linkingPromptTask: null,
          plateLinkingProcedure: null,
          currentSaveId: null,
          sharedLinkMetadata: null,
          snapshotsByCount: {},
          mode: hasLinks ? "linking" : "setup",
        };

      upsertSavedLock(buildSavedLockRecord(importedState, {
        id: createLockId(),
        name: sharedUrl.name.trim() || getDefaultLockName(),
        description: sharedUrl.description.trim(),
        hasCustomName: Boolean(sharedUrl.name.trim()),
        isDraft: !allLinksKnown,
      }));
      });

      setAppState((current) => ({
        ...current,
        ...createInitialAppState(),
        mode: "load",
        linkingPromptTask: null,
        plateLinkingProcedure: null,
        solutionReturnState: null,
        sharedLinkMetadata: null,
      }));
      return;
    }

    const imported = parseImportedNotationInput(text);
    const parsed = parseNotationString(imported.notation);
    const hasLinks = parsed.links.some(Boolean);
    const allLinksKnown = parsed.links.every(Boolean);
    const shouldShowSolution = showSolution || imported.isShareUrl;
    const nextSharedLinkMetadata = sharedLinkMetadata ?? (imported.isShareUrl
      ? {
          name: imported.name || "",
          description: imported.description || "",
        }
      : null);
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
      if (shouldShowSolution) {
        setAppState(() => enterSolutionMode(baseState, {
          returnState: imported.isShareUrl ? createInitialAppState() : undefined,
          solutionOrigin: imported.isShareUrl ? "load" : null,
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
