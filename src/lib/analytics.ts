import type { AppMode, ModalState } from "./types";

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    gtag?: (command: string, eventName: string, params?: AnalyticsParams) => void;
  }
}

function sendAnalyticsEvent(eventName: string, params: AnalyticsParams) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  window.gtag("event", eventName, {
    app_name: "gothic-lockpick",
    page_path: window.location.pathname,
    ...params,
  });
}

export function getScreenAnalyticsName(mode: AppMode) {
  if (mode === "menu") {
    return "Main Menu";
  }

  if (mode === "load") {
    return "Load Lock";
  }

  if (mode === "import") {
    return "Import Notation";
  }

  if (mode === "setup") {
    return "Plates Setup";
  }

  if (mode === "linking") {
    return "Plates Linking";
  }

  if (mode === "manual_linking") {
    return "Manual Linking";
  }

  if (mode === "ready_to_solve") {
    return "Ready To Solve";
  }

  if (mode === "solution") {
    return "Solution";
  }

  if (mode === "testing") {
    return "Testing Mode";
  }

  return mode;
}

export function getModalAnalyticsName(modal: ModalState) {
  if (!modal.type) {
    return null;
  }

  if (modal.type === "save-current") {
    return "Save Current";
  }

  if (modal.type === "rename-saved") {
    return "Rename Saved";
  }

  if (modal.type === "delete-saved") {
    return "Delete Saved";
  }

  if (modal.type === "delete-all-drafts") {
    return "Delete All Drafts";
  }

  if (modal.type === "solution-steps") {
    return "Solution Steps";
  }

  if (modal.type === "powershell") {
    return "PowerShell";
  }

  if (modal.type === "notation") {
    return "Notation";
  }

  if (modal.type === "share") {
    return "Share";
  }

  return null;
}

export function trackScreenView(screenName: string) {
  sendAnalyticsEvent("screen_view", { screen_name: screenName });
}

export function trackModalView(modalName: string | null) {
  if (!modalName) {
    return;
  }

  sendAnalyticsEvent("modal_view", { modal_name: modalName });
}

export function trackButtonClick(params: {
  label: string;
  screen: string;
  modal?: string | null;
  context?: string | null;
}) {
  sendAnalyticsEvent("button_click", {
    button_label: params.label,
    screen_name: params.screen,
    modal_name: params.modal || null,
    click_context: params.context || null,
  });
}
