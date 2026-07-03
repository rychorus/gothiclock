import { STORAGE_KEY, buildSavedLockRecord, cloneOffsets, createLockId, isTrivialCenteredLock } from "./lockData";
import { buildNotationString } from "./notation";
import { buildShareUrl } from "../screens/shared/shareUrl";
import type { AppStateData, SavedLockRecord } from "./types";

function getStorage() {
  return window.localStorage;
}

function offsetsEqual(left: number[] | null | undefined, right: number[] | null | undefined) {
  if (!left || !right || left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function linksEqual(left: Array<number[] | null> | null | undefined, right: Array<number[] | null> | null | undefined) {
  if (!left || !right || left.length !== right.length) {
    return false;
  }

  return left.every((link, index) => {
    const otherLink = right[index];
    if (!link && !otherLink) {
      return true;
    }

    if (!link || !otherLink || link.length !== otherLink.length) {
      return false;
    }

    return link.every((value, linkIndex) => value === otherLink[linkIndex]);
  });
}

function linksCompatible(left: Array<number[] | null> | null | undefined, right: Array<number[] | null> | null | undefined) {
  if (!left || !right || left.length !== right.length) {
    return false;
  }

  return left.every((link, index) => {
    const otherLink = right[index];
    if (!link || !otherLink) {
      return true;
    }

    if (link.length !== otherLink.length) {
      return false;
    }

    return link.every((value, linkIndex) => value === otherLink[linkIndex]);
  });
}

function getSavedLockStartOffsets(lock: SavedLockRecord) {
  return lock.linkingStartOffsets || lock.currentOffsets;
}

function normalizeSavedLock(lock: Partial<SavedLockRecord>): SavedLockRecord {
  const name = lock.name || "Untitled lock";
  return {
    id: lock.id || createLockId(),
    name,
    description: lock.description || "",
    hasCustomName: typeof lock.hasCustomName === "boolean" ? lock.hasCustomName : /^((Draft - )?Lock \d+)$/.test(name) ? false : Boolean(name),
    submissionEligible: typeof lock.submissionEligible === "boolean" ? lock.submissionEligible : undefined,
    isDraft: Boolean(lock.isDraft),
    savedAt: lock.savedAt || new Date().toISOString(),
    plateCount: lock.plateCount || 0,
    mode: lock.mode || "menu",
    linkingStartOffsets: lock.linkingStartOffsets || null,
    currentOffsets: lock.currentOffsets || [],
    links: lock.links || [],
    linkDeltas: lock.linkDeltas || [],
  };
}

export function getSavedLocks(): SavedLockRecord[] {
  try {
    return (JSON.parse(getStorage().getItem(STORAGE_KEY) || "[]") as Partial<SavedLockRecord>[]).map(normalizeSavedLock);
  } catch {
    return [];
  }
}

export function setSavedLocks(locks: SavedLockRecord[]) {
  getStorage().setItem(STORAGE_KEY, JSON.stringify(locks));
}

export function deleteAllSavedLocks() {
  setSavedLocks([]);
}

export function getSavedLockById(lockId: string | null | undefined): SavedLockRecord | null {
  if (!lockId) {
    return null;
  }

  return getSavedLocks().find((lock) => lock.id === lockId) || null;
}

export function findSavedLockMatchingSetup(state: Pick<AppStateData, "plateCount" | "offsets">, locks = getSavedLocks()): SavedLockRecord | null {
  return locks
    .filter((lock) => lock.plateCount === state.plateCount)
    .filter((lock) => lock.currentOffsets.length === state.offsets.length)
    .filter((lock) => lock.currentOffsets.every((offset, index) => offset === state.offsets[index]))
    .sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime())[0] || null;
}

export function upsertSavedLock(lockRecord: SavedLockRecord) {
  const savedLocks = getSavedLocks();
  const nextLocks = savedLocks.filter((lock) => lock.id !== lockRecord.id);
  nextLocks.unshift(lockRecord);
  setSavedLocks(nextLocks);
}

export function getDefaultLockName(): string {
  const savedLocks = getSavedLocks();
  let nextNumber = 1;

  while (savedLocks.some((lock) => lock.name === `Lock ${nextNumber}` || lock.name === `Draft - Lock ${nextNumber}`)) {
    nextNumber += 1;
  }

  return `Lock ${nextNumber}`;
}

function stripLegacyDraftPrefix(name) {
  return name?.replace(/^Draft - /, "") || "";
}

function isDefaultTemplateName(name: string) {
  return /^((Draft - )?Lock \d+)$/.test(name.trim());
}

function findMatchingDraftForState(state: AppStateData) {
  const savedLocks = getSavedLocks();
  const exactMatch = savedLocks.find((lock) => (
    lock.isDraft
    && lock.plateCount === state.plateCount
    && offsetsEqual(lock.linkingStartOffsets, state.linkingStartOffsets)
    && offsetsEqual(lock.currentOffsets, state.offsets)
    && offsetsEqual(lock.linkDeltas, state.linkDeltas)
    && linksEqual(lock.links, state.links)
  ));

  if (exactMatch) {
    return exactMatch;
  }

  return savedLocks.find((lock) => (
    lock.isDraft
    && lock.plateCount === state.plateCount
    && offsetsEqual(getSavedLockStartOffsets(lock), state.linkingStartOffsets || state.offsets)
    && linksCompatible(lock.links, state.links)
  )) || null;
}

export function persistCurrentLock(
  state: AppStateData,
  { isDraft, nameOverride, descriptionOverride }: { isDraft?: boolean; nameOverride?: string; descriptionOverride?: string } = {},
) {
  const normalizedState = state.linkingStartOffsets || !state.solution?.startOffsets
    ? state
    : { ...state, linkingStartOffsets: cloneOffsets(state.solution.startOffsets) };

  if (!normalizedState.linkingStartOffsets || (!isDraft && isTrivialCenteredLock(normalizedState))) {
    return null;
  }

  const existingLock = getSavedLockById(normalizedState.currentSaveId)
    || (isDraft ? findMatchingDraftForState(normalizedState) : null);
  const fallbackName = stripLegacyDraftPrefix(existingLock?.name) || getDefaultLockName();
  const name = nameOverride?.trim() || fallbackName;
  const description = descriptionOverride?.trim() || existingLock?.description || "";
  const lockId = normalizedState.currentSaveId || existingLock?.id || createLockId();
  const hasCustomName = Boolean(existingLock?.hasCustomName) || !isDefaultTemplateName(name);
  const submissionEligible = Boolean(existingLock?.submissionEligible)
    || (normalizedState.mode === "solution" && Boolean(normalizedState.plateLinkingProcedure));

  upsertSavedLock(buildSavedLockRecord(normalizedState, {
    id: lockId,
    name,
    description,
    isDraft,
    hasCustomName,
    submissionEligible,
  }));
  return lockId;
}

export function upsertImportedLock(
  state: AppStateData,
  {
    name,
    description,
    isDraft,
    hasCustomName,
    submissionEligible,
  }: {
    name: string;
    description: string;
    isDraft?: boolean;
    hasCustomName?: boolean;
    submissionEligible?: boolean;
  },
) {
  const existingDraft = findMatchingDraftForState(state);
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  const nextName = existingDraft?.hasCustomName
    ? existingDraft.name
    : trimmedName || existingDraft?.name || getDefaultLockName();
  const nextDescription = trimmedDescription || existingDraft?.description || "";

  upsertSavedLock(buildSavedLockRecord(state, {
    id: existingDraft?.id || createLockId(),
    name: nextName,
    description: nextDescription,
    isDraft,
    hasCustomName: Boolean(existingDraft?.hasCustomName) || Boolean(hasCustomName),
    submissionEligible: typeof submissionEligible === "boolean"
      ? submissionEligible
      : existingDraft?.submissionEligible,
  }));
}

export function buildSavedLocksExportText(locks: SavedLockRecord[], baseUrl: string) {
  return locks.map((lock) => {
    const url = buildShareUrl(
      baseUrl,
      buildNotationString({
        plateCount: lock.plateCount,
        offsets: lock.currentOffsets,
        links: lock.links,
      }),
      {
        name: lock.hasCustomName ? lock.name : undefined,
        description: lock.description,
        compactState: {
          plateCount: lock.plateCount,
          offsets: lock.currentOffsets,
          links: lock.links,
        },
      },
    );

    return [
      lock.name,
      lock.description || "",
      url,
    ].filter(Boolean).join("\n");
  }).join("\n\n");
}

export function renameSavedLock(lockId: string, nextName: string, nextDescription?: string) {
  const trimmedName = nextName.trim();
  if (!trimmedName) {
    return;
  }
  const trimmedDescription = nextDescription?.trim() || "";

  const nextLocks = getSavedLocks().map((lock) => {
    if (lock.id !== lockId) {
      return lock;
    }

    return {
      ...lock,
      name: trimmedName,
      description: trimmedDescription,
      hasCustomName: lock.hasCustomName || !isDefaultTemplateName(trimmedName),
      isDraft: false,
      savedAt: new Date().toISOString(),
    };
  });

  setSavedLocks(nextLocks);
}

export function deleteSavedLock(lockId: string) {
  setSavedLocks(getSavedLocks().filter((lock) => lock.id !== lockId));
}

export function deleteAllDraftLocks() {
  setSavedLocks(getSavedLocks().filter((lock) => !lock.isDraft));
}

export function clearSavedLockSubmissionEligibility() {
  setSavedLocks(getSavedLocks().map((lock) => {
    const nextLock = { ...lock };
    delete nextLock.submissionEligible;
    return nextLock;
  }));
}

export function syncFinalLockProgress(state: AppStateData) {
  if (
    state.mode !== "solution"
    || isTrivialCenteredLock(state)
    || state.currentSaveId
    || state.sharedLinkMetadata
  ) {
    return null;
  }

  return persistCurrentLock(state, { isDraft: true });
}
