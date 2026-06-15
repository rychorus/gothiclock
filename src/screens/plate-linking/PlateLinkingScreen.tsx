import { LockStage } from "../shared/LockStage";
import { PlateLinkingPromptActions } from "./prompt/PlateLinkingPromptActions";
import { createPlateLinkingPrompt } from "./prompt/createPlateLinkingPrompt";

export function PlateLinkingScreen({ appState, currentSolutionChunk, testingFeedback, selectors, actions }) {
  const prompt = appState.linkingPromptTask
    ? createPlateLinkingPrompt(appState.linkingPromptTask, appState.plateCount)
    : null;
  const isFirstLinkingStep = appState.linkingPromptTask?.phase === "move" && (appState.plateLinkingProcedure?.history.length ?? 0) === 0;

  return (
    <>
      <LockStage
        appState={appState}
        currentSolutionChunk={currentSolutionChunk}
        testingFeedback={testingFeedback}
        selectors={selectors}
        actions={actions}
        showResetButton
        showManualButton
        onOpenManualLinking={actions.startManualLinkingMode}
        instruction={prompt?.message ?? ""}
      />

      <PlateLinkingPromptActions
        task={appState.linkingPromptTask}
        hasObservation={selectors.hasPlateObservation()}
        isFirstStep={isFirstLinkingStep}
        onBack={actions.stepBackPlateLinkingPrompt}
        onAdvance={actions.advancePlateLinkingPrompt}
        onComplete={actions.completePlateLinkingPrompt}
      />
    </>
  );
}
