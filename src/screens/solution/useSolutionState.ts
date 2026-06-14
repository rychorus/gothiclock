import { useMemo } from "react";
import { buildSolutionCommandString, buildWasdSequence, setSolutionStep, enterTestingMode, returnToSolutionView } from "./solutionState";
import type { AppStateData } from "../../lib/types";
import type { SolutionChunkData } from "../plate-linking/model/types";
import type { Dispatch, SetStateAction } from "react";

export function useSolutionState({ appState, setAppState }: {
  appState: AppStateData;
  setAppState: Dispatch<SetStateAction<AppStateData>>;
}) {
  const currentSolutionChunk: SolutionChunkData | null = appState.mode === "solution" ? appState.solution?.chunks?.[appState.solution?.index ?? 0] || null : null;
  const powershellCode = `$myKeys = "${buildSolutionCommandString(appState.solution?.chunks)}"; $delayR = 1500; $delayAD = 500; $delayOthers = 100; Start-Sleep -Seconds 10; Add-Type -AssemblyName System.Windows.Forms; $myKeys.ToCharArray() | ForEach-Object { [System.Windows.Forms.SendKeys]::SendWait($_); if ($_ -match '^[R]$') { Start-Sleep -Milliseconds $delayR } elseif ($_ -match '^[AD]$') { Start-Sleep -Milliseconds $delayAD } else { Start-Sleep -Milliseconds $delayOthers } }`;

  return useMemo(() => ({
    currentSolutionChunk,
    powershellCode,
    wasdSequence: buildWasdSequence(appState.solution?.chunks),
    setSolutionStep: (index: number) => setAppState((current) => setSolutionStep(current, index)),
    enterTestingMode: () => setAppState(enterTestingMode),
    returnToSolutionView: () => setAppState(returnToSolutionView),
    goToMainMenu: () => setAppState((current) => ({ ...current, mode: "menu", currentTask: null })),
  }), [appState, currentSolutionChunk, powershellCode, setAppState]);
}
