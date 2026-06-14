import { setPlateCount, startNewLock, startOver } from "./plateSetupState";
import { startPlateLinkingPrompt } from "../plate-linking/prompt/plateLinkingPromptState";
import type { AppStateData } from "../../lib/types";
import type { Dispatch, SetStateAction } from "react";

export function usePlateSetupState({ setAppState }: {
  setAppState: Dispatch<SetStateAction<AppStateData>>;
}) {
  return {
    startNewLock: () => setAppState(startNewLock),
    setPlateCount: (count: number) => {
      document.body.classList.add("is-resizing");
      setAppState((current) => setPlateCount(current, count));
      requestAnimationFrame(() => setTimeout(() => document.body.classList.remove("is-resizing"), 80));
    },
    startOver: () => setAppState(startOver),
    startLinkingMode: () => setAppState(startPlateLinkingPrompt),
  };
}
