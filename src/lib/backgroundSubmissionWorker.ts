import { encodeCompactLock } from "./compactNotation";
import type { SavedLockRecord, SolutionPlanData } from "./types";

type SubmissionPayload = {
  lockId: string;
  saveType: "named" | "draft";
  appVersion: string;
  fingerprintHash: string;
  setupString: string;
  clientSubmittedAt: string;
  source: string;
  userAgent: string;
  savedLock: {
    id: string;
    name: string;
    description: string;
    isDraft: boolean;
    plateCount: number;
    mode: string;
    setupString: string;
  };
  solution: null | {
    moves: SolutionPlanData["moves"];
    chunks: SolutionPlanData["chunks"];
    startOffsets: SolutionPlanData["startOffsets"];
  };
  proofOfWork: {
    difficulty: number;
    nonce: string;
    hash: string;
  };
};

type SubmissionWorkerRequest = {
  type: "submit";
  payload: {
    endpoint: string;
    proofOfWorkDifficulty: number;
    appVersion: string;
    savedLock: SavedLockRecord;
    solution: SolutionPlanData | null;
    fingerprintSource: {
      userAgent: string;
      language: string;
      languages: readonly string[];
      platform: string;
      hardwareConcurrency: number;
      maxTouchPoints: number;
      colorDepth: number | null;
      screenWidth: number | null;
      screenHeight: number | null;
      pixelRatio: number;
      timezone: string;
    };
  };
};

type SubmissionWorkerResponse =
  | {
      type: "submitted";
      lockId: string;
    }
  | {
      type: "failed";
      lockId: string;
      error: string;
    };

let fingerprintHashPromise: Promise<string> | null = null;

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const sorted: Record<string, unknown> = {};
  Object.keys(value).sort().forEach((key) => {
    sorted[key] = sortDeep((value as Record<string, unknown>)[key]);
  });
  return sorted;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256HexFallback(value: string): string {
  const input = new TextEncoder().encode(value);
  const bitLength = input.length * 8;
  const paddedLength = (((input.length + 9 + 63) >> 6) << 6);
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.length] = 0x80;

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

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const cryptoApi = globalThis.crypto;

  if (!cryptoApi?.subtle) {
    return sha256HexFallback(value);
  }

  const digest = await cryptoApi.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function buildSetupString(savedLock: SavedLockRecord): string {
  return encodeCompactLock({
    plateCount: savedLock.plateCount,
    offsets: savedLock.currentOffsets,
    links: savedLock.links,
  });
}

async function getFingerprintHash(fingerprintSource: SubmissionWorkerRequest["payload"]["fingerprintSource"]): Promise<string> {
  if (fingerprintHashPromise) {
    return fingerprintHashPromise;
  }

  fingerprintHashPromise = sha256Hex(stableStringify(fingerprintSource));
  return fingerprintHashPromise;
}

async function computeProofOfWork(
  payload: Omit<SubmissionPayload, "proofOfWork">,
  difficulty: number,
): Promise<SubmissionPayload["proofOfWork"]> {
  const solutionHash = await sha256Hex(stableStringify(
    payload.solution || {
      setupString: payload.setupString,
      plateCount: payload.savedLock.plateCount,
      mode: payload.savedLock.mode,
      isDraft: payload.savedLock.isDraft,
    },
  ));
  const prefix = "0".repeat(difficulty);
  const powMessage = `gothic-lockpick|${payload.appVersion}|${payload.fingerprintHash}|${solutionHash}`;
  let nonce = 0;
  let hash = "";

  while (!hash.startsWith(prefix)) {
    nonce += 1;
    hash = await sha256Hex(`${powMessage}|${nonce}`);
  }

  return {
    difficulty,
    nonce: String(nonce),
    hash,
  };
}

async function buildSubmissionPayload(args: SubmissionWorkerRequest["payload"]): Promise<SubmissionPayload> {
  const setupString = buildSetupString(args.savedLock);
  const payloadBase = {
    lockId: args.savedLock.id,
    saveType: args.savedLock.isDraft ? "draft" as const : "named" as const,
    appVersion: args.appVersion,
    fingerprintHash: await getFingerprintHash(args.fingerprintSource),
    setupString,
    clientSubmittedAt: new Date().toISOString(),
    source: "gothic-lockpick-app",
    userAgent: args.fingerprintSource.userAgent,
    savedLock: {
      id: args.savedLock.id,
      name: args.savedLock.name,
      description: args.savedLock.description,
      isDraft: args.savedLock.isDraft,
      plateCount: args.savedLock.plateCount,
      mode: args.savedLock.mode,
      setupString,
    },
    solution: args.solution
      ? {
          moves: args.solution.moves,
          chunks: args.solution.chunks,
          startOffsets: args.solution.startOffsets,
        }
      : null,
  };

  return {
    ...payloadBase,
    proofOfWork: await computeProofOfWork(payloadBase, args.proofOfWorkDifficulty),
  };
}

async function submitInBackground(endpoint: string, payload: SubmissionPayload) {
  await fetch(endpoint, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
}

self.addEventListener("message", (event: MessageEvent<SubmissionWorkerRequest>) => {
  if (event.data.type !== "submit") {
    return;
  }

  void buildSubmissionPayload(event.data.payload)
    .then((payload) => submitInBackground(event.data.payload.endpoint, payload).then(() => payload.lockId))
    .then((lockId) => {
      const response: SubmissionWorkerResponse = { type: "submitted", lockId };
      self.postMessage(response);
    })
    .catch((error) => {
      const response: SubmissionWorkerResponse = {
        type: "failed",
        lockId: event.data.payload.savedLock.id,
        error: error instanceof Error ? error.message : String(error),
      };
      self.postMessage(response);
    });
});

export {};
