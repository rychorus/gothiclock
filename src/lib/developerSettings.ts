export const BACKGROUND_SUBMISSION_ENDPOINT = "https://script.google.com/macros/s/AKfycbxKLoyiBpC7QmVCNoGuLmKQtOHUTBYLfJQi69vdvUGyzLODpMDTTbghIUD4KthGG7Yh/exec";
export const PRODUCTION_BACKGROUND_SUBMISSION_ENABLED = false;
export const PRODUCTION_PROOF_OF_WORK_DIFFICULTY = 4;
export const DEV_UNLOCK_TOKEN_HASH = "68c709f03f4e1e2c3fe3b97e4d548cbc4c8d8402a1ab6a908c4914d89d930a4f";

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

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.subtle) {
    const digest = await cryptoApi.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  const bitLength = encoded.length * 8;
  const paddedLength = (((encoded.length + 9 + 63) >> 6) << 6);
  const padded = new Uint8Array(paddedLength);
  padded.set(encoded);
  padded[encoded.length] = 0x80;

  const lengthView = new DataView(padded.buffer);
  lengthView.setUint32(paddedLength - 4, bitLength >>> 0, false);
  lengthView.setUint32(paddedLength - 8, Math.floor(bitLength / 2 ** 32), false);

  const initialHash = new Uint32Array([
    0x6a09e667,
    0xbb67ae85,
    0x3c6ef372,
    0xa54ff53a,
    0x510e527f,
    0x9b05688c,
    0x1f83d9ab,
    0x5be0cd19,
  ]);

  const constants = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  const words = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = lengthView.getUint32(offset + (index * 4), false);
    }

    for (let index = 16; index < 64; index += 1) {
      const s0 = rightRotate(words[index - 15], 7) ^ rightRotate(words[index - 15], 18) ^ (words[index - 15] >>> 3);
      const s1 = rightRotate(words[index - 2], 17) ^ rightRotate(words[index - 2], 19) ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }

    let a = initialHash[0];
    let b = initialHash[1];
    let c = initialHash[2];
    let d = initialHash[3];
    let e = initialHash[4];
    let f = initialHash[5];
    let g = initialHash[6];
    let h = initialHash[7];

    for (let index = 0; index < 64; index += 1) {
      const sigma1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + sigma1 + choice + constants[index] + words[index]) >>> 0;
      const sigma0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sigma0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    initialHash[0] = (initialHash[0] + a) >>> 0;
    initialHash[1] = (initialHash[1] + b) >>> 0;
    initialHash[2] = (initialHash[2] + c) >>> 0;
    initialHash[3] = (initialHash[3] + d) >>> 0;
    initialHash[4] = (initialHash[4] + e) >>> 0;
    initialHash[5] = (initialHash[5] + f) >>> 0;
    initialHash[6] = (initialHash[6] + g) >>> 0;
    initialHash[7] = (initialHash[7] + h) >>> 0;
  }

  return Array.from(initialHash)
    .map((part) => part.toString(16).padStart(8, "0"))
    .join("");
}

export function getPersistedDeveloperSettings(): DeveloperSettings {
  if (typeof window === "undefined") {
    return {
      isUnlocked: false,
      backgroundSubmissionEnabled: false,
      pastSavesSubmissionEnabled: true,
    };
  }

  try {
    return {
      isUnlocked: getStorage().getItem(DEVELOPER_SETTINGS_UNLOCKED_STORAGE_KEY) === "true",
      backgroundSubmissionEnabled: getStorage().getItem(BACKGROUND_SUBMISSION_ENABLED_STORAGE_KEY) === "true",
      pastSavesSubmissionEnabled: getStorage().getItem(PAST_SAVES_SUBMISSION_ENABLED_STORAGE_KEY) !== "false",
    };
  } catch {
    return {
      isUnlocked: false,
      backgroundSubmissionEnabled: false,
      pastSavesSubmissionEnabled: true,
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
  if (!settings.isUnlocked) {
    return true;
  }

  return settings.backgroundSubmissionEnabled;
}

export async function isDeveloperUnlockTokenInput(text: string): Promise<boolean> {
  const trimmed = text.trim();
  if (trimmed.length < 2 || !trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return false;
  }

  const candidate = trimmed.slice(1, -1).trim();
  if (!candidate) {
    return false;
  }

  return (await sha256Hex(candidate)) === DEV_UNLOCK_TOKEN_HASH;
}
