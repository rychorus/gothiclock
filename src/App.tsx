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
    if (!("serviceWorker" in navigator) || (!window.isSecureContext && !getIsLocalhost())) {
      return;
    }

    navigator.serviceWorker.register(new URL("sw.js", window.location.origin + import.meta.env.BASE_URL).toString()).catch((error) => {
      console.error("Service worker registration failed", error);
    });
  }, []);

  return <LockpickAppView app={app} appVersion={APP_VERSION} />;
}

export default App;
