export const DEV_UNLOCK_TOKEN = "{dev}";
export const BACKGROUND_SUBMISSION_ENDPOINT = "https://script.google.com/macros/s/AKfycbxKLoyiBpC7QmVCNoGuLmKQtOHUTBYLfJQi69vdvUGyzLODpMDTTbghIUD4KthGG7Yh/exec";
export const PRODUCTION_BACKGROUND_SUBMISSION_ENABLED = false;
export const PRODUCTION_PROOF_OF_WORK_DIFFICULTY = 4;

const DEVELOPER_SETTINGS_UNLOCKED_STORAGE_KEY = "gothic-lockpick.developer-settings.unlocked";
const BACKGROUND_SUBMISSION_ENABLED_STORAGE_KEY = "gothic-lockpick.background-submission.enabled";
const PAST_SAVES_SUBMISSION_ENABLED_STORAGE_KEY = "gothic-lockpick.past-saves-submission.enabled";

export interface DeveloperSettings {
  isUnlocked: boolean;
  backgroundSubmissionEnabled: boolean;
  pastSavesSubmissionEnabled: boolean;
}

function getStorage() {
  return window.localStorage;
}

export function getPersistedDeveloperSettings(): DeveloperSettings {
  if (typeof window === "undefined") {
    return {
      isUnlocked: false,
      backgroundSubmissionEnabled: false,
      pastSavesSubmissionEnabled: false,
    };
  }

  try {
    return {
      isUnlocked: getStorage().getItem(DEVELOPER_SETTINGS_UNLOCKED_STORAGE_KEY) === "true",
      backgroundSubmissionEnabled: getStorage().getItem(BACKGROUND_SUBMISSION_ENABLED_STORAGE_KEY) === "true",
      pastSavesSubmissionEnabled: getStorage().getItem(PAST_SAVES_SUBMISSION_ENABLED_STORAGE_KEY) === "true",
    };
  } catch {
    return {
      isUnlocked: false,
      backgroundSubmissionEnabled: false,
      pastSavesSubmissionEnabled: false,
    };
  }
}

export function persistDeveloperSettings(settings: DeveloperSettings): DeveloperSettings {
  if (typeof window === "undefined") {
    return settings;
  }

  try {
    getStorage().setItem(DEVELOPER_SETTINGS_UNLOCKED_STORAGE_KEY, String(settings.isUnlocked));
    getStorage().setItem(BACKGROUND_SUBMISSION_ENABLED_STORAGE_KEY, String(settings.backgroundSubmissionEnabled));
    getStorage().setItem(PAST_SAVES_SUBMISSION_ENABLED_STORAGE_KEY, String(settings.pastSavesSubmissionEnabled));
  } catch {
    // Ignore storage failures and keep the settings in memory.
  }

  return settings;
}

export function unlockDeveloperSettings(current: DeveloperSettings): DeveloperSettings {
  return persistDeveloperSettings({
    ...current,
    isUnlocked: true,
  });
}

export function disableDeveloperSettings(): DeveloperSettings {
  return persistDeveloperSettings({
    isUnlocked: false,
    backgroundSubmissionEnabled: false,
    pastSavesSubmissionEnabled: false,
  });
}

export function setBackgroundSubmissionEnabled(current: DeveloperSettings, enabled: boolean): DeveloperSettings {
  return persistDeveloperSettings({
    ...current,
    backgroundSubmissionEnabled: enabled,
  });
}

export function setPastSavesSubmissionEnabled(current: DeveloperSettings, enabled: boolean): DeveloperSettings {
  return persistDeveloperSettings({
    ...current,
    pastSavesSubmissionEnabled: enabled,
  });
}

export function isBackgroundSubmissionEnabled(settings: DeveloperSettings): boolean {
  return PRODUCTION_BACKGROUND_SUBMISSION_ENABLED || settings.backgroundSubmissionEnabled;
}
