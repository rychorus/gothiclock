import uiClickUrl from "../assets/ui-click.wav?url";

type UiClickAudioState = {
  context: AudioContext | null;
  bufferPromise: Promise<AudioBuffer> | null;
  nextStartTime: number;
};

const uiClickAudioState: UiClickAudioState = {
  context: null,
  bufferPromise: null,
  nextStartTime: 0,
};

const UI_CLICK_SPACING_SECONDS = 0.018;
const UI_CLICK_GAIN = 0.14;
const UI_CLICK_START_LAG_SECONDS = 0.001;

function getAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextCtor = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    return null;
  }

  if (!uiClickAudioState.context) {
    uiClickAudioState.context = new AudioContextCtor();
  }

  return uiClickAudioState.context;
}

async function loadUiBuffer(context: AudioContext) {
  if (!uiClickAudioState.bufferPromise) {
    uiClickAudioState.bufferPromise = fetch(uiClickUrl)
      .then((response) => response.arrayBuffer())
      .then((arrayBuffer) => context.decodeAudioData(arrayBuffer));
  }

  return uiClickAudioState.bufferPromise;
}

function scheduleClick(context: AudioContext, buffer: AudioBuffer, when: number) {
  const source = context.createBufferSource();
  source.buffer = buffer;
  const gain = context.createGain();
  gain.gain.value = UI_CLICK_GAIN;
  source.connect(gain);
  gain.connect(context.destination);
  source.start(when);
}

async function queueUiClicks(count: number) {
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

    const buffer = await loadUiBuffer(context);
    const now = context.currentTime;
    if (uiClickAudioState.nextStartTime < now - 0.08) {
      uiClickAudioState.nextStartTime = now + UI_CLICK_START_LAG_SECONDS;
    } else {
      uiClickAudioState.nextStartTime = Math.max(uiClickAudioState.nextStartTime, now + UI_CLICK_START_LAG_SECONDS);
    }

    for (let index = 0; index < safeCount; index += 1) {
      scheduleClick(context, buffer, uiClickAudioState.nextStartTime);
      uiClickAudioState.nextStartTime += UI_CLICK_SPACING_SECONDS;
    }
  } catch {
    // Ignore browsers that block playback or fail to decode audio.
  }
}

export function playUiClick() {
  void queueUiClicks(1);
}
