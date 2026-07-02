import type { SavedLockRecord, SolutionPlanData } from "./types";
import { BACKGROUND_SUBMISSION_ENDPOINT, PRODUCTION_PROOF_OF_WORK_DIFFICULTY } from "./developerSettings";

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

let submissionWorker: Worker | null = null;

function getSubmissionWorker(): Worker | null {
  if (typeof window === "undefined" || typeof window.Worker !== "function") {
    return null;
  }

  if (submissionWorker) {
    return submissionWorker;
  }

  submissionWorker = new Worker(new URL("./backgroundSubmissionWorker.ts", import.meta.url), { type: "module" });
  return submissionWorker;
}

export function queueBackgroundSubmission(args: {
  appVersion: string;
  savedLock: SavedLockRecord;
  solution: SolutionPlanData | null;
}): void {
  if (typeof window === "undefined" || typeof window.fetch !== "function" || !BACKGROUND_SUBMISSION_ENDPOINT) {
    return;
  }

  const worker = getSubmissionWorker();
  if (!worker) {
    return;
  }

  const message: SubmissionWorkerRequest = {
    type: "submit",
    payload: {
      endpoint: BACKGROUND_SUBMISSION_ENDPOINT,
      proofOfWorkDifficulty: PRODUCTION_PROOF_OF_WORK_DIFFICULTY,
      appVersion: args.appVersion,
      savedLock: args.savedLock,
      solution: args.solution,
      fingerprintSource: {
        userAgent: window.navigator.userAgent,
        language: window.navigator.language,
        languages: window.navigator.languages,
        platform: window.navigator.platform,
        hardwareConcurrency: window.navigator.hardwareConcurrency,
        maxTouchPoints: window.navigator.maxTouchPoints,
        colorDepth: window.screen?.colorDepth ?? null,
        screenWidth: window.screen?.width ?? null,
        screenHeight: window.screen?.height ?? null,
        pixelRatio: window.devicePixelRatio,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    },
  };

  worker.postMessage(message);
}
