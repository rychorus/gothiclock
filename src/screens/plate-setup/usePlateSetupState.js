import { setPlateCount, startNewLock, startOver } from "./plateSetupState";
import { startLinkingMode } from "../plate-linking/linkingState";

export function usePlateSetupState({ setAppState }) {
  return {
    startNewLock: () => setAppState(startNewLock),
    setPlateCount: (count) => {
      document.body.classList.add("is-resizing");
      setAppState((current) => setPlateCount(current, count));
      requestAnimationFrame(() => setTimeout(() => document.body.classList.remove("is-resizing"), 80));
    },
    startOver: () => setAppState(startOver),
    startLinkingMode: () => setAppState(startLinkingMode),
  };
}
