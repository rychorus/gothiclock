import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CENTER_INDEX, createIdentityLink, createInitialAppState } from "../src/lib/lockData";
import { getVisiblePlateLabel, parseNotationString } from "../src/lib/notation";
import type { AppStateData, PlateLink, PlateLinks, SolutionMoveData } from "../src/lib/types";
import {
  advancePlateLinkingPrompt,
  recordBlockedPlateLinkingObservation,
  updatePlateLinkingObservation,
} from "../src/screens/plate-linking/prompt/plateLinkingPromptState";
import {
  advancePlateLinkingCenterPrompt,
  advancePlateLinkingResetPrompt,
  completePlateLinkingObservation,
  startFreshPlateLinkingProcedure,
} from "../src/screens/plate-linking/procedure/plateLinkingProcedure";

type LockFixture = { name: string; notation: string; source: string };
type TraceEntry = { step: number; action: string; offsets: number[] };
type SimulationResult = {
  name: string;
  passed: boolean;
  steps: number;
  probes: number;
  blockedProbes: number;
  centeringMoves: number;
  solutionMoves: number;
  warning?: string;
  error?: string;
  trace?: TraceEntry[];
};

const args = process.argv.slice(2);
const inputPath = args.find((argument) => !argument.startsWith("--"));
const verbose = args.includes("--verbose");
const maxStepsArgument = args.find((argument) => argument.startsWith("--max-steps="));
const maxSteps = maxStepsArgument
  ? Number.parseInt(maxStepsArgument.slice("--max-steps=".length), 10)
  : 10_000;

if (!inputPath) {
  console.error("Usage: npm run test:plate-linking -- <notations.txt> [--verbose] [--max-steps=10000]");
  process.exit(2);
}
if (!Number.isInteger(maxSteps) || maxSteps < 1) {
  console.error("--max-steps must be a positive integer.");
  process.exit(2);
}

function extractFixtures(text: string): LockFixture[] {
  const fixtures: LockFixture[] = [];
  for (const match of text.matchAll(/https?:\/\/[^\s]+/g)) {
    try {
      const url = new URL(match[0]);
      const notation = url.searchParams.get("notation");
      if (notation) {
        fixtures.push({
          name: url.searchParams.get("name") || `Lock ${fixtures.length + 1}`,
          notation,
          source: match[0],
        });
      }
    } catch {
      // Ignore malformed URLs. A file with no share URLs is parsed as raw notation below.
    }
  }
  return fixtures.length > 0
    ? fixtures
    : [{ name: "Raw notation", notation: text.trim(), source: inputPath! }];
}

function normalizeTrueLinks(links: PlateLinks, plateCount: number): { links: PlateLink[]; missing: number[] } {
  const missing: number[] = [];
  return {
    links: links.map((link, index) => {
      if (link) return [...link];
      missing.push(index);
      return createIdentityLink(plateCount, index);
    }),
    missing,
  };
}

function applyPhysicalMove(offsets: number[], link: PlateLink, delta: number): number[] | null {
  const next = offsets.map((offset, index) => offset + link[index] * delta);
  return next.some((offset) => offset < -CENTER_INDEX || offset > CENTER_INDEX) ? null : next;
}

function compactStateSignature(state: AppStateData, physicalOffsets: number[]): string {
  const task = state.linkingPromptTask;
  const procedure = state.plateLinkingProcedure;
  return JSON.stringify({
    mode: state.mode,
    offsets: state.offsets,
    physicalOffsets,
    links: state.links,
    task: task && {
      phase: task.phase,
      driver: task.driver,
      delta: task.delta,
      startOffsets: task.startOffsets,
      baseOffsets: task.baseOffsets,
      blockedObservations: task.blockedObservations,
    },
    procedure: procedure && {
      completedDrivers: procedure.completedDrivers,
      pendingDrivers: procedure.pendingDrivers,
      deferredDrivers: procedure.deferredDrivers,
      partialLinks: procedure.partialLinks,
      lastTriedDeltas: procedure.lastTriedDeltas,
    },
  });
}

function formatOffsets(offsets: number[]): string {
  return `[${offsets.join(",")}]`;
}

function describeMove(plateCount: number, driver: number, delta: number): string {
  return `${getVisiblePlateLabel(driver, plateCount)} ${delta < 0 ? "left" : "right"}`;
}

function describeProcedure(state: AppStateData): string {
  const procedure = state.plateLinkingProcedure;
  if (!procedure) return "procedure=none";
  const label = (index: number) => getVisiblePlateLabel(index, state.plateCount);
  const deferred = procedure.deferredDrivers
    .map((entry) => `${label(entry.driver)}<-[${entry.blockedBy.map(label).join(",")}]`)
    .join(" ") || "none";
  return [
    `completed=[${procedure.completedDrivers.map(label).join(",")}]`,
    `pending=[${procedure.pendingDrivers.map(label).join(",")}]`,
    `deferred=${deferred}`,
  ].join("; ");
}

function assertOffsetsMatch(state: AppStateData, physicalOffsets: number[], context: string): void {
  if (state.offsets.some((offset, index) => offset !== physicalOffsets[index])) {
    throw new Error(
      `Model/physical divergence after ${context}: app=${formatOffsets(state.offsets)}, physical=${formatOffsets(physicalOffsets)}`,
    );
  }
}

function validateSolution(
  startOffsets: number[],
  trueLinks: PlateLink[],
  moves: SolutionMoveData[] | null,
): { count: number; error?: string } {
  if (!moves) return { count: 0, error: "The procedure entered solution mode without finding a solution." };

  let offsets = [...startOffsets];
  for (let index = 0; index < moves.length; index += 1) {
    const move = moves[index];
    const next = applyPhysicalMove(offsets, trueLinks[move.plate], move.delta);
    if (!next) {
      return {
        count: index,
        error: `Solution move ${index + 1} (${describeMove(trueLinks.length, move.plate, move.delta)}) is physically blocked at ${formatOffsets(offsets)}.`,
      };
    }
    offsets = next;
  }
  return offsets.some((offset) => offset !== 0)
    ? { count: moves.length, error: `Solution finished away from center: ${formatOffsets(offsets)}.` }
    : { count: moves.length };
}

function simulateFixture(fixture: LockFixture): SimulationResult {
  const trace: TraceEntry[] = [];
  let steps = 0;
  let probes = 0;
  let blockedProbes = 0;
  let centeringMoves = 0;

  try {
    const parsed = parseNotationString(fixture.notation);
    const normalized = normalizeTrueLinks(parsed.links, parsed.plateCount);
    const trueLinks = normalized.links;
    const initialOffsets = [...parsed.offsets];
    let physicalOffsets = [...initialOffsets];
    let state: AppStateData = startFreshPlateLinkingProcedure({
      ...createInitialAppState(),
      plateCount: parsed.plateCount,
      offsets: [...initialOffsets],
      mode: "setup",
    });
    const seen = new Map<string, number>();

    while (steps < maxSteps) {
      if (state.mode === "solution") {
        const solution = validateSolution(initialOffsets, trueLinks, state.solution?.moves ?? null);
        if (solution.error) throw new Error(solution.error);
        return {
          name: fixture.name,
          passed: true,
          steps,
          probes,
          blockedProbes,
          centeringMoves,
          solutionMoves: solution.count,
          warning: normalized.missing.length
            ? `Missing link definitions treated as identity: ${normalized.missing.map((index) => getVisiblePlateLabel(index, parsed.plateCount)).join(", ")}`
            : undefined,
          trace: verbose ? trace : undefined,
        };
      }

      const task = state.linkingPromptTask;
      if (state.mode !== "linking" || !task) {
        throw new Error(`Procedure stopped unexpectedly in mode=${state.mode}, task=${task?.phase ?? "none"}.`);
      }

      const signature = compactStateSignature(state, physicalOffsets);
      const previousStep = seen.get(signature);
      if (previousStep !== undefined) {
        throw new Error(
          `Loop detected: step ${steps} repeats step ${previousStep} (cycle length ${steps - previousStep}); ${describeProcedure(state)}.`,
        );
      }
      seen.set(signature, steps);

      if (task.phase === "move") {
        const description = `probe ${describeMove(parsed.plateCount, task.driver, task.delta)}`;
        trace.push({ step: steps, action: description, offsets: [...physicalOffsets] });
        probes += 1;
        const trueLink = trueLinks[task.driver];
        const nextPhysical = applyPhysicalMove(physicalOffsets, trueLink, task.delta);
        state = advancePlateLinkingPrompt(state);

        if (nextPhysical) {
          for (let target = 0; target < parsed.plateCount; target += 1) {
            if (target !== task.driver && trueLink[target] !== 0) {
              state = updatePlateLinkingObservation(
                state,
                target,
                state.offsets[target] + trueLink[target] * task.delta,
              );
            }
          }
          physicalOffsets = nextPhysical;
          assertOffsetsMatch(state, physicalOffsets, description);
        } else {
          blockedProbes += 1;
          for (let target = 0; target < parsed.plateCount; target += 1) {
            const attemptedDelta = trueLink[target] * task.delta;
            const attemptedOffset = physicalOffsets[target] + attemptedDelta;
            if (
              target !== task.driver
              && attemptedDelta !== 0
              && (attemptedOffset < -CENTER_INDEX || attemptedOffset > CENTER_INDEX)
            ) {
              state = recordBlockedPlateLinkingObservation(state, target, attemptedDelta);
            }
          }
        }
        state = completePlateLinkingObservation(state);
        // Entering solution mode deliberately resets the displayed model to the
        // original setup because the first solution instruction is "Reset".
        if (state.mode === "linking") {
          assertOffsetsMatch(state, physicalOffsets, `${description} completion`);
        }
      } else if (task.phase === "center") {
        const description = `center ${describeMove(parsed.plateCount, task.driver, task.delta)}`;
        trace.push({ step: steps, action: description, offsets: [...physicalOffsets] });
        const nextPhysical = applyPhysicalMove(physicalOffsets, trueLinks[task.driver], task.delta);
        if (!nextPhysical) {
          throw new Error(`Centering instruction is physically blocked: ${description} at ${formatOffsets(physicalOffsets)}.`);
        }
        physicalOffsets = nextPhysical;
        state = advancePlateLinkingCenterPrompt(state);
        centeringMoves += 1;
        if (state.mode === "linking") {
          assertOffsetsMatch(state, physicalOffsets, description);
        }
      } else if (task.phase === "reset") {
        const description = "reset to starting positions";
        trace.push({ step: steps, action: description, offsets: [...physicalOffsets] });
        physicalOffsets = [...initialOffsets];
        state = advancePlateLinkingResetPrompt(state);
        assertOffsetsMatch(state, physicalOffsets, description);
      } else {
        throw new Error(
          task.phase === "stalled"
            ? `Guided linking stalled: ${task.stalledReason || "no reason provided"}; ${describeProcedure(state)}.`
            : `Unsupported prompt phase: ${task.phase}.`,
        );
      }
      steps += 1;
    }
    throw new Error(`Exceeded the ${maxSteps}-step safety limit.`);
  } catch (error) {
    return {
      name: fixture.name,
      passed: false,
      steps,
      probes,
      blockedProbes,
      centeringMoves,
      solutionMoves: 0,
      error: error instanceof Error ? error.message : String(error),
      trace: trace.slice(-30),
    };
  }
}

function printTrace(trace: TraceEntry[] | undefined): void {
  for (const entry of trace ?? []) {
    console.log(`      ${String(entry.step).padStart(4)}  ${entry.action.padEnd(22)} ${formatOffsets(entry.offsets)}`);
  }
}

async function main(): Promise<void> {
  const input = await readFile(resolve(inputPath!), "utf8");
  const fixtures = extractFixtures(input);
  const results = fixtures.map(simulateFixture);
  const failures = results.filter((result) => !result.passed);

  for (const result of results) {
    if (result.passed) {
      console.log(
        `PASS  ${result.name} (${result.steps} guidance steps, ${result.probes} probes, ${result.blockedProbes} blocked, ${result.centeringMoves} centering, ${result.solutionMoves} solution moves)`,
      );
      if (result.warning) console.log(`      warning: ${result.warning}`);
      if (verbose) printTrace(result.trace);
    } else {
      console.error(`FAIL  ${result.name}: ${result.error}`);
      printTrace(result.trace);
    }
  }

  const totalSteps = results.reduce((sum, result) => sum + result.steps, 0);
  console.log(`\n${results.length - failures.length}/${results.length} locks passed; ${failures.length} failed; ${totalSteps} total guidance steps.`);
  process.exitCode = failures.length > 0 ? 1 : 0;
}

void main();
