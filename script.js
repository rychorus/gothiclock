const { refs } = window.GothicLockpickCore;
const { createAppController } = window.GothicLockpickAppController;

const app = createAppController();

refs.modalBackdrop?.addEventListener("click", app.closeModal);
refs.modalClose?.addEventListener("click", app.closeModal);
refs.heroBack?.addEventListener("click", app.goToMainMenu);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !refs.modalShell.hidden) {
    app.closeModal();
  }
});

refs.stageReset.addEventListener("click", app.resetPlates);
refs.stageStartOver?.addEventListener("click", app.startOver);

let lastViewportWidth = window.innerWidth;

window.addEventListener("resize", () => {
  if (window.innerWidth !== lastViewportWidth) {
    lastViewportWidth = window.innerWidth;
    app.renderPlates();
    return;
  }

  app.measureStepSize();
  app.refreshPlateUI();
});

const isLocalhost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "[::1]";

if ("serviceWorker" in navigator && (window.isSecureContext || isLocalhost)) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Service worker registration failed", error);
    });
  });
}

app.renderAll();
