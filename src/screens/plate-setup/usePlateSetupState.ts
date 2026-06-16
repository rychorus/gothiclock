import { setPlateCount, startNewLock, startOver } from "./plateSetupState";
import { startFreshPlateLinkingProcedure } from "../plate-linking/procedure/plateLinkingProcedure";
import type { AppStateData, ModalState } from "../../lib/types";
import type { Dispatch, SetStateAction } from "react";
import { findSavedLockMatchingSetup } from "../../lib/lockStorage";

export function usePlateSetupState({ appState, setAppState, setModal }: {
  appState: AppStateData;
  setAppState: Dispatch<SetStateAction<AppStateData>>;
  setModal: (modal: ModalState) => void;
}) {
  return {
    startNewLock: () => setAppState(startNewLock),
    setPlateCount: (count: number) => {
      document.body.classList.add("is-resizing");
      setAppState((current) => setPlateCount(current, count));
      requestAnimationFrame(() => setTimeout(() => document.body.classList.remove("is-resizing"), 80));
    },
    startOver: () => setAppState(startOver),
    startLinkingMode: () => {
      const matchingLock = findSavedLockMatchingSetup(appState);
      if (matchingLock) {
        setModal({ type: "start-linking-match", lockId: matchingLock.id });
        return;
      }

      setAppState(startFreshPlateLinkingProcedure);
    },
    continueLinkingMode: () => setAppState(startFreshPlateLinkingProcedure),
  };
}
