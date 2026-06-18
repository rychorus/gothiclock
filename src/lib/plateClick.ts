import plateClickUrl from "../assets/plate-click.wav?url";

type ClickAudioState = {
  context: AudioContext | null;
  bufferPromise: Promise<AudioBuffer> | null;
  nextStartTime: number;
};

const clickAudioState: ClickAudioState = {
  context: null,
  bufferPromise: null,
  nextStartTime: 0,
};

const CLICK_SPACING_SECONDS = 0.032;
const CLICK_GAIN = 0.14;
const CLICK_START_LAG_SECONDS = 0.002;

function getAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextCtor = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    return null;
  }

  if (!clickAudioState.context) {
    clickAudioState.context = new AudioContextCtor();
  }

  return clickAudioState.context;
}

async function loadClickBuffer(context: AudioContext) {
  if (!clickAudioState.bufferPromise) {
    clickAudioState.bufferPromise = fetch(plateClickUrl)
      .then((response) => response.arrayBuffer())
      .then((arrayBuffer) => context.decodeAudioData(arrayBuffer));
  }

  return clickAudioState.bufferPromise;
}

function scheduleClick(context: AudioContext, buffer: AudioBuffer, when: number) {
  const source = context.createBufferSource();
  source.buffer = buffer;
  const gain = context.createGain();
  gain.gain.value = CLICK_GAIN;
  source.connect(gain);
  gain.connect(context.destination);
  source.start(when);
}

async function queueClicks(count: number) {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount <= 0) {
    return;
  }

  try {
    if (context.state === "suspended") {
      await context.resume();
    }

    const buffer = await loadClickBuffer(context);
    const now = context.currentTime;
    if (clickAudioState.nextStartTime < now - 0.08) {
      clickAudioState.nextStartTime = now + CLICK_START_LAG_SECONDS;
    } else {
      clickAudioState.nextStartTime = Math.max(clickAudioState.nextStartTime, now + CLICK_START_LAG_SECONDS);
    }

    for (let index = 0; index < safeCount; index += 1) {
      scheduleClick(context, buffer, clickAudioState.nextStartTime);
      clickAudioState.nextStartTime += CLICK_SPACING_SECONDS;
    }
  } catch {
    // Ignore browsers that block playback or fail to decode audio.
  }
}

export function playPlateClick() {
  void queueClicks(1);
}

export function playPlateClicks(count: number) {
  void queueClicks(count);
}
