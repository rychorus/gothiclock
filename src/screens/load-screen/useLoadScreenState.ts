import {
  buildSavedLocksExportText,
  deleteAllDraftLocks,
  deleteAllSavedLocks,
  deleteSavedLock,
  getDefaultLockName,
  getSavedLockById,
  getSavedLocks,
  persistCurrentLock,
  upsertSavedLock,
  renameSavedLock,
} from "../../lib/lockStorage";
import { loadSavedLockState } from "../../lib/appState";
import { isDeveloperUnlockTokenInput } from "../../lib/developerSettings";
import type { AppStateData, ModalState, SavedLockRecord } from "../../lib/types";
import type { Dispatch, SetStateAction } from "react";
import { startPlateLinkingProcedure } from "../plate-linking/procedure/plateLinkingProcedure";
import { extractImportedShareUrls } from "../shared/shareUrl";
import { buildSavedLockRecord, createEmptyLinkDeltas, createInitialAppState, createLockId } from "../../lib/lockData";
import { parseNotationString } from "../../lib/notation";

export function useLoadScreenState({ appState, setAppState, setModal, onDeveloperUnlock, onSavedLockPersisted }: {
  appState: AppStateData;
  setAppState: Dispatch<SetStateAction<AppStateData>>;
  setModal: (modal: ModalState) => void;
  onDeveloperUnlock?: () => void;
  onSavedLockPersisted?: (savedLock: SavedLockRecord, solution: AppStateData["solution"]) => void;
}) {
  function saveCurrentLock() {
    if (!appState.linkingStartOffsets && !appState.solution?.startOffsets) {
      return;
    }

    const existingLock = getSavedLockById(appState.currentSaveId);
    const fallbackName = existingLock?.isDraft
      ? existingLock.name || getDefaultLockName()
      : existingLock?.name || appState.sharedLinkMetadata?.name || getDefaultLockName();
    const fallbackDescription = existingLock?.description || appState.sharedLinkMetadata?.description || "";
    setModal({ type: "save-current", value: fallbackName, description: fallbackDescription });
  }

  function persistWithName(name: string, description: string, isDraft = false) {
    const lockId = persistCurrentLock(appState, { isDraft, nameOverride: name, descriptionOverride: description });
    if (lockId) {
      const savedLock = getSavedLockById(lockId);
      setAppState((current) => ({ ...current, currentSaveId: lockId }));
      if (savedLock) {
        onSavedLockPersisted?.(savedLock, appState.solution);
      }
    }
    setModal({ type: null });
  }

  function loadSavedLock(lockId: string) {
    const savedLock = getSavedLockById(lockId);
    if (!savedLock) {
      return;
    }

    setAppState((current) => {
      const loadedState = loadSavedLockState(current, savedLock);
      return savedLock.isDraft
        ? startPlateLinkingProcedure(loadedState)
        : loadedState;
    });
  }

  function renameLock(lockId: string, name: string, description?: string) {
    renameSavedLock(lockId, name, description);
    const savedLock = getSavedLockById(lockId);
    if (savedLock) {
      onSavedLockPersisted?.(savedLock, appState.solution);
    }
    setModal({ type: null });
  }

  function removeLock(lockId: string) {
    deleteSavedLock(lockId);
    setAppState((current) => (current.currentSaveId === lockId ? { ...current, currentSaveId: null } : current));
    setModal({ type: null });
  }

  function removeAllDrafts() {
    const currentSave = getSavedLockById(appState.currentSaveId);
    deleteAllDraftLocks();
    setAppState((current) => (currentSave?.isDraft ? { ...current, currentSaveId: null } : current));
    setModal({ type: null });
  }

  function removeAllSavedLocks() {
    deleteAllSavedLocks();
    setAppState((current) => ({ ...current, currentSaveId: null }));
    setModal({ type: null });
  }

  function exportAllSavedLocks() {
    const savedLocks = getSavedLocks();
    if (!savedLocks.length || typeof window === "undefined") {
      return;
    }

    const exportText = buildSavedLocksExportText(savedLocks, window.location.href);
    const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "GothicLocks - Rychorus.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }

  async function importLocks(text: string): Promise<"developer-unlock" | void> {
    if (await isDeveloperUnlockTokenInput(text)) {
      onDeveloperUnlock?.();
      setModal({ type: "developer-settings" });
      return "developer-unlock";
    }

    const importedShareUrls = extractImportedShareUrls(text);
    if (!importedShareUrls.length) {
      throw new Error("Paste one or more share links, or upload a text file containing them.");
    }

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
        submissionEligible: false,
      }));
    });

    setModal({ type: null });
  }

  return {
    savedLocks: getSavedLocks(),
    saveCurrentLock,
    persistWithName,
    loadSavedLock,
    renameLock,
    removeLock,
    removeAllDrafts,
    removeAllSavedLocks,
    exportAllSavedLocks,
    importLocks,
  };
}
