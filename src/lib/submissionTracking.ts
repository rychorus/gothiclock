import type { SavedLockRecord } from "./types";

const SUBMITTED_SAVE_SIGNATURES_STORAGE_KEY = "gothic-lockpick.submitted-save-signatures";
const SUBMISSION_TRACKING_VERSION_STORAGE_KEY = "gothic-lockpick.submission-tracking-version";
const SUBMISSION_TRACKING_VERSION = "6";

function getStorage() {
  return window.localStorage;
}

function ensureTrackingStoreVersion() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const currentVersion = getStorage().getItem(SUBMISSION_TRACKING_VERSION_STORAGE_KEY);
    if (currentVersion === SUBMISSION_TRACKING_VERSION) {
      return;
    }

    // Reset old optimistic submission marks from earlier iterations.
    getStorage().removeItem(SUBMITTED_SAVE_SIGNATURES_STORAGE_KEY);
    getStorage().setItem(SUBMISSION_TRACKING_VERSION_STORAGE_KEY, SUBMISSION_TRACKING_VERSION);
  } catch {
    // Ignore storage failures and fall back to best-effort tracking.
  }
}

export function getSavedLockSubmissionSignature(savedLock: SavedLockRecord): string {
  return JSON.stringify({
    id: savedLock.id,
    name: savedLock.name,
    description: savedLock.description,
    isDraft: savedLock.isDraft,
    submissionEligible: savedLock.submissionEligible,
    savedAt: savedLock.savedAt,
    plateCount: savedLock.plateCount,
    mode: savedLock.mode,
    linkingStartOffsets: savedLock.linkingStartOffsets,
    currentOffsets: savedLock.currentOffsets,
    links: savedLock.links,
    linkDeltas: savedLock.linkDeltas,
  });
}

function getSubmittedSaveSignatures(): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    ensureTrackingStoreVersion();
    const stored = getStorage().getItem(SUBMITTED_SAVE_SIGNATURES_STORAGE_KEY);
    if (!stored) {
      return {};
    }

    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, string>
      : {};
  } catch {
    return {};
  }
}

function persistSubmittedSaveSignatures(signatures: Record<string, string>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    ensureTrackingStoreVersion();
    getStorage().setItem(SUBMITTED_SAVE_SIGNATURES_STORAGE_KEY, JSON.stringify(signatures));
  } catch {
    // Ignore storage failures and keep submission tracking in memory only.
  }
}

export function hasSavedLockBeenSubmitted(savedLock: SavedLockRecord): boolean {
  return getSubmittedSaveSignatures()[savedLock.id] === getSavedLockSubmissionSignature(savedLock);
}

export function markSavedLockSubmitted(savedLock: SavedLockRecord) {
  const submittedSignatures = getSubmittedSaveSignatures();
  submittedSignatures[savedLock.id] = getSavedLockSubmissionSignature(savedLock);
  persistSubmittedSaveSignatures(submittedSignatures);
}

export function markSavedLocksSubmitted(savedLocks: SavedLockRecord[]) {
  if (!savedLocks.length) {
    return;
  }

  const submittedSignatures = getSubmittedSaveSignatures();
  savedLocks.forEach((savedLock) => {
    submittedSignatures[savedLock.id] = getSavedLockSubmissionSignature(savedLock);
  });
  persistSubmittedSaveSignatures(submittedSignatures);
}

export function clearSubmittedSaveSignatures() {
  persistSubmittedSaveSignatures({});
}
