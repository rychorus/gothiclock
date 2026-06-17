import { useEffect } from "react";
import { useRef } from "react";
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
  const touchTapSlop = 40;
  const touchButtonPressRef = useRef<{
    pointerId: number;
    button: HTMLButtonElement;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    document.title = "Gothic Lock";
  }, []);

  useEffect(() => {
    function getButtonFromEventTarget(target: EventTarget | null) {
      if (!(target instanceof Element)) {
        return null;
      }

      const button = target.closest("button");
      return button instanceof HTMLButtonElement ? button : null;
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.pointerType !== "touch") {
        return;
      }

      const button = getButtonFromEventTarget(event.target);
      if (!button || button.disabled) {
        return;
      }

      touchButtonPressRef.current = {
        pointerId: event.pointerId,
        button,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
      };
      button.classList.add("is-touch-pressed");
    }

    function handlePointerMove(event: PointerEvent) {
      const activePress = touchButtonPressRef.current;
      if (!activePress || activePress.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = Math.abs(event.clientX - activePress.startX);
      const deltaY = Math.abs(event.clientY - activePress.startY);
      if (deltaX > touchTapSlop || deltaY > touchTapSlop) {
        activePress.moved = true;
      }
    }

    function handlePointerUp(event: PointerEvent) {
      const activePress = touchButtonPressRef.current;
      if (!activePress || activePress.pointerId !== event.pointerId) {
        return;
      }

      touchButtonPressRef.current = null;
      activePress.button.classList.remove("is-touch-pressed");

      if (activePress.moved || activePress.button.disabled || !activePress.button.isConnected) {
        return;
      }

      const releaseButton = getButtonFromEventTarget(event.target);
      if (releaseButton && activePress.button.contains(releaseButton)) {
        return;
      }

      activePress.button.click();
    }

    function handlePointerCancel(event: PointerEvent) {
      const activePress = touchButtonPressRef.current;
      if (activePress?.pointerId === event.pointerId) {
        activePress.button.classList.remove("is-touch-pressed");
        touchButtonPressRef.current = null;
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("pointermove", handlePointerMove, true);
    document.addEventListener("pointerup", handlePointerUp, true);
    document.addEventListener("pointercancel", handlePointerCancel, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("pointermove", handlePointerMove, true);
      document.removeEventListener("pointerup", handlePointerUp, true);
      document.removeEventListener("pointercancel", handlePointerCancel, true);
    };
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
