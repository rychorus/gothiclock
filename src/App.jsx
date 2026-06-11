import { useEffect } from "react";

const BASE_URL = import.meta.env.BASE_URL;
const LEGACY_SCRIPTS = ["js/core.js", "js/solution.js", "js/plate-ui.js", "js/app-controller.js"];

const PLATE_TEMPLATE_HTML = `
  <article class="plate-column">
    <button class="plate-button" type="button" data-direction="up" aria-label="Move plate up">
      <span></span>
    </button>
    <div class="plate-viewport">
      <div class="plate-direction-cue" aria-hidden="true">
        <span></span>
      </div>
      <div class="center-band" aria-hidden="true">
        <span class="center-marker">
          <span class="center-marker-cap"></span>
          <span class="center-dot"></span>
        </span>
      </div>
      <div class="plate-track">
        <div class="plate-body">
          <div class="hole-stack"></div>
        </div>
      </div>
    </div>
    <button class="plate-button" type="button" data-direction="down" aria-label="Move plate down">
      <span></span>
    </button>
    <div class="plate-status-row">
      <span class="plate-status" aria-hidden="true"></span>
    </div>
  </article>
`;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-legacy-src="${src}"]`);
    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }

    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.legacySrc = src;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true }
    );
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.body.appendChild(script);
  });
}

function withBaseUrl(path) {
  return new URL(path, window.location.origin + BASE_URL).toString();
}

function getIsLocalhost() {
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "[::1]"
  );
}

function ensurePlateTemplate() {
  const template = document.getElementById("plateTemplate");
  if (!template) {
    return;
  }

  if (template.innerHTML.trim() === PLATE_TEMPLATE_HTML.trim()) {
    return;
  }

  template.innerHTML = PLATE_TEMPLATE_HTML;
}

function App() {
  useEffect(() => {
    let isDisposed = false;
    let app = null;
    let lastViewportWidth = window.innerWidth;

    const handleEscape = (event) => {
      const refs = window.GothicLockpickCore?.refs;
      if (event.key === "Escape" && refs && !refs.modalShell.hidden) {
        app?.closeModal();
      }
    };

    const handleResize = () => {
      if (!app) {
        return;
      }

      if (window.innerWidth !== lastViewportWidth) {
        lastViewportWidth = window.innerWidth;
        app.renderPlates();
        return;
      }

      app.measureStepSize();
      app.refreshPlateUI();
    };

    async function bootstrap() {
      ensurePlateTemplate();

      for (const src of LEGACY_SCRIPTS) {
        await loadScript(withBaseUrl(src));
      }

      if (isDisposed) {
        return;
      }

      const { refs } = window.GothicLockpickCore;
      const { createAppController } = window.GothicLockpickAppController;

      app = createAppController();

      refs.modalBackdrop?.addEventListener("click", app.closeModal);
      refs.modalClose?.addEventListener("click", app.closeModal);
      refs.heroBack?.addEventListener("click", app.goToMainMenu);
      refs.stageReset?.addEventListener("click", app.resetPlates);
      refs.stageStartOver?.addEventListener("click", app.startOver);
      document.addEventListener("keydown", handleEscape);
      window.addEventListener("resize", handleResize);

      if ("serviceWorker" in navigator && (window.isSecureContext || getIsLocalhost())) {
        window.addEventListener(
          "load",
          () => {
            navigator.serviceWorker.register(withBaseUrl("sw.js")).catch((error) => {
              console.error("Service worker registration failed", error);
            });
          },
          { once: true }
        );
      }

      app.renderAll();
    }

    bootstrap().catch((error) => {
      console.error("Failed to bootstrap the Gothic Lockpick app", error);
    });

    return () => {
      isDisposed = true;
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleResize);

      const refs = window.GothicLockpickCore?.refs;
      if (refs && app) {
        refs.modalBackdrop?.removeEventListener("click", app.closeModal);
        refs.modalClose?.removeEventListener("click", app.closeModal);
        refs.heroBack?.removeEventListener("click", app.goToMainMenu);
        refs.stageReset?.removeEventListener("click", app.resetPlates);
        refs.stageStartOver?.removeEventListener("click", app.startOver);
      }
    };
  }, []);

  return (
    <>
      <main className="app-shell">
        <section className="panel">
          <header className="hero">
            <button className="hero-back" id="heroBack" type="button" aria-label="Back to main menu" hidden>
              <span></span>
            </button>
            <p className="hero-title" id="heroTitle">
              <span className="hero-title-line">Gothic Remake</span>
              <span className="hero-title-line hero-title-line--accent">Lockpick Solver</span>
            </p>
            <span className="app-version" id="appVersion" aria-label="App version"></span>
          </header>

          <section className="controls-card" id="modePanel" aria-live="polite"></section>

          <section className="lock-stage">
            <div className="stage-instruction" id="stageInstruction" aria-live="polite"></div>
            <button className="stage-start-over" id="stageStartOver" type="button" hidden>
              Start over
            </button>
            <button className="stage-reset" id="stageReset" type="button" hidden>
              Reset
            </button>
            <div className="plates-row" id="platesRow" aria-label="Lock plates"></div>
          </section>

          <section className="bottom-panel" id="bottomPanel" hidden></section>

          <div className="footer-actions" id="footerActions"></div>
        </section>
      </main>

      <div className="modal-shell" id="modalShell" hidden>
        <div className="modal-backdrop" id="modalBackdrop"></div>
        <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
          <header className="modal-header">
            <h2 className="modal-title" id="modalTitle"></h2>
            <button className="modal-close" id="modalClose" type="button" aria-label="Close dialog">
              &times;
            </button>
          </header>
          <div className="modal-body" id="modalBody"></div>
          <div className="modal-actions" id="modalActions"></div>
        </section>
      </div>

      <template id="plateTemplate"></template>
    </>
  );
}

export default App;
