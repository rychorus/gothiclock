import { useEffect } from "react";
import { APP_VERSION } from "./lib/lockData";
import { useLockpickApp } from "./hooks/useLockpickApp";
import { LockpickAppView } from "./components/LockpickAppView";

function getIsLocalhost() {
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "[::1]"
  );
}

function App() {
  const app = useLockpickApp();

  useEffect(() => {
    document.title = "Gothic Lock";
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (getIsLocalhost()) {
      navigator.serviceWorker.getRegistrations?.().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
        });
      }).catch((error) => {
        console.error("Service worker cleanup failed", error);
      });

      if ("caches" in window) {
        caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).catch((error) => {
          console.error("Cache cleanup failed", error);
        });
      }

      return;
    }

    if (!window.isSecureContext) {
      return;
    }

    navigator.serviceWorker.register(new URL("sw.js", window.location.origin + import.meta.env.BASE_URL).toString()).catch((error) => {
      console.error("Service worker registration failed", error);
    });
  }, []);

  return <LockpickAppView app={app} appVersion={APP_VERSION} />;
}

export default App;
