(function () {
  const APP_VERSION = "v1.5.7";
  const MIN_PLATES = 3;
  const MAX_PLATES = 7;
  const HOLE_COUNT = 7;
  const CENTER_INDEX = 3;
  const START_COUNT = 5;

  const STORAGE_KEY = "gothic-lockpick.saved-locks";

  const refs = {
    appVersion: document.getElementById("appVersion"),
    heroBack: document.getElementById("heroBack"),
    heroTitle: document.getElementById("heroTitle"),
    modePanel: document.getElementById("modePanel"),
    footerActions: document.getElementById("footerActions"),
    platesRow: document.getElementById("platesRow"),
    plateTemplate: document.getElementById("plateTemplate"),
    lockStage: document.querySelector(".lock-stage"),
    stageInstruction: document.getElementById("stageInstruction"),
    stageStartOver: document.getElementById("stageStartOver"),
    stageReset: document.getElementById("stageReset"),
    bottomPanel: document.getElementById("bottomPanel"),
    modalShell: document.getElementById("modalShell"),
    modalBackdrop: document.getElementById("modalBackdrop"),
    modalTitle: document.getElementById("modalTitle"),
    modalBody: document.getElementById("modalBody"),
    modalActions: document.getElementById("modalActions"),
    modalClose: document.getElementById("modalClose"),
  };

  const state = {
    plateCount: START_COUNT,
    offsets: Array.from({ length: START_COUNT }, () => 0),
    stepSize: 0,
    mode: "menu",
    linkingStartOffsets: null,
    links: createEmptyLinks(START_COUNT),
    currentTask: null,
    solution: null,
    currentSaveId: null,
    lastPromptSignature: "",
    snapshotsByCount: {},
  };

  if (refs.appVersion) {
    refs.appVersion.textContent = APP_VERSION;
    refs.appVersion.title = `Current version: ${APP_VERSION}`;
  }

  function createEmptyLinks(count) {
    return Array.from({ length: count }, () => null);
  }

  function createIdentityLink(count, driverIndex) {
    return Array.from({ length: count }, (_, index) => (index === driverIndex ? 1 : 0));
  }

  function cloneOffsets(offsets) {
    return [...offsets];
  }

  function resizeOffsets(offsets, count) {
    return Array.from({ length: count }, (_, index) => offsets?.[index] ?? 0);
  }

  function resizeLink(link, count) {
    if (!link) {
      return null;
    }

    return Array.from({ length: count }, (_, index) => link[index] ?? 0);
  }

  function clampOffset(offset) {
    return Math.max(-CENTER_INDEX, Math.min(CENTER_INDEX, offset));
  }

  function getSavedLocks() {
    try {
      return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function setSavedLocks(locks) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(locks));
  }

  function getSavedLockById(lockId) {
    if (!lockId) {
      return null;
    }

    return getSavedLocks().find((lock) => lock.id === lockId) || null;
  }

  function createLockId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function upsertSavedLock(lockRecord) {
    const savedLocks = getSavedLocks();
    const nextLocks = savedLocks.filter((lock) => lock.id !== lockRecord.id);
    nextLocks.unshift(lockRecord);
    setSavedLocks(nextLocks);
  }

  function getDefaultLockName() {
    const savedLocks = getSavedLocks();
    let nextNumber = 1;

    while (savedLocks.some((lock) => lock.name === `Lock ${nextNumber}` || lock.name === `Draft - Lock ${nextNumber}`)) {
      nextNumber += 1;
    }

    return `Lock ${nextNumber}`;
  }

  function escapeHtmlAttribute(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  async function copyTextToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Fall back to selection-based copy below.
      }
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    textarea.style.top = "0";
    textarea.style.left = "0";
    document.body.appendChild(textarea);

    const selection = document.getSelection();
    const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }

    document.body.removeChild(textarea);
    if (selection) {
      selection.removeAllRanges();
      if (previousRange) {
        selection.addRange(previousRange);
      }
    }

    return copied;
  }

  function getMaterialIconMarkup(name) {
    const paths = {
      more_vert: '<path d="M12 8a2 2 0 110-4 2 2 0 010 4zm0 4a2 2 0 110 4 2 2 0 010-4zm0 8a2 2 0 110-4 2 2 0 010 4z"></path>',
      edit: '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l8.06-8.06.92.92L5.92 19.58zM20.71 7.04a1.003 1.003 0 000-1.42L18.37 3.29a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.83z"></path>',
      delete: '<path d="M6 19c0 1.1.9 2 2 2h8a2 2 0 002-2V7H6v12zm3.46-7.12l1.54 1.54 1.54-1.54 1.06 1.06-1.54 1.54 1.54 1.54-1.06 1.06L11 15.54l-1.54 1.54-1.06-1.06 1.54-1.54-1.54-1.54 1.06-1.06zM15.5 4l-1-1h-5l-1 1H5v2h14V4z"></path>',
      save: '<path d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7l-4-4zM12 19a3 3 0 110-6 3 3 0 010 6zm3-10H5V5h10v4z"></path>',
      restart_alt: '<path d="M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6a6 6 0 11-11.95-.75H4.02A8 8 0 1012 5z"></path>',
      chevron_left: '<path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"></path>',
      chevron_right: '<path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"></path>',
      open_in_full: '<path d="M21 3h-6v2h2.59l-3.83 3.83 1.41 1.41L19 6.41V9h2V3zM3 15h2v2.59l3.83-3.83 1.41 1.41L6.41 19H9v2H3v-6zm6.41-4.76L5.59 6.41H8V4H2v6h2V7.41l3.83 3.83 1.58-1zm5.17 3.59l-1.41 1.41L17.59 19H15v2h6v-6h-2v2.59l-4.42-4.42z"></path>',
      fullscreen: '<path d="M7 14H5v5h5v-2H7v-3zm0-4h2V7h3V5H5v5zm10 7h-3v2h5v-5h-2v3zm0-12v2h-3v2h5V5h-2z"></path>',
    };

    return `<span class="material-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">${paths[name] || ""}</svg></span>`;
  }

  window.GothicLockpickCore = {
    APP_VERSION,
    MIN_PLATES,
    MAX_PLATES,
    HOLE_COUNT,
    CENTER_INDEX,
    START_COUNT,
    STORAGE_KEY,
    refs,
    state,
    createEmptyLinks,
    createIdentityLink,
    cloneOffsets,
    resizeOffsets,
    resizeLink,
    clampOffset,
    getSavedLocks,
    setSavedLocks,
    getSavedLockById,
    createLockId,
    upsertSavedLock,
    getDefaultLockName,
    escapeHtmlAttribute,
    escapeHtml,
    copyTextToClipboard,
    getMaterialIconMarkup,
  };
}());
