import { CENTER_INDEX, cloneOffsets } from "./lockData";
import { getVisiblePlateLabel } from "./notation";
import type {
  AppStateData,
  Offsets,
  PlateLink,
  PlateLinks,
  SolutionChunkData,
  SolutionMoveData,
  SolutionPlanData,
} from "./types";

export function getActionDelta(normalizedLink: PlateLink, delta: number): number[] {
  return normalizedLink.map((value) => value * delta);
}

export function groupConsecutiveKeys(keys: string[]): Array<{ key: string; count: number }> {
  const groups = [];

  for (let index = 0; index < keys.length; ) {
    let count = 1;
    while (index + count < keys.length && keys[index + count] === keys[index]) {
      count += 1;
    }
    groups.push({ key: keys[index], count });
    index += count;
  }

  return groups;
}

export function formatKeyGroups(groups: Array<{ key: string; count: number }>): string {
  return groups.map(({ key, count }) => (count > 1 ? `${key}\u00d7${count}` : key)).join(" ");
}

export function formatSolutionStepLabel(move: SolutionMoveData, plateCount: number): string {
  const plateLabel = getVisiblePlateLabel(move.plate, plateCount);
  const directionLabel = move.direction === "up" ? "<" : ">";
  return `${plateLabel} ${directionLabel}`;
}

export function formatSolutionStepInstruction(
  chunk: Pick<SolutionChunkData, "type" | "move"> | null | undefined,
  plateCount: number,
): string {
  if (!chunk) {
    return "";
  }

  if (chunk.type === "reset") {
    return "Reset";
  }

  if (chunk.type === "solved") {
    return "Solved";
  }

  if (!chunk.move) {
    return "";
  }

  const plateNumber = plateCount - chunk.move.plate;
  const directionLabel = chunk.move.direction === "up" ? "Left" : "Right";
  return `Move Plate ${plateNumber} ${directionLabel}`;
}

export function buildSolutionChunks(
  moves: SolutionMoveData[],
  startOffsets: Offsets,
  links: PlateLinks,
): SolutionChunkData[] {
  const chunks: SolutionChunkData[] = [{
    id: "reset",
    type: "reset",
    label: "Reset",
    keys: ["R"],
    keyGroups: [{ key: "R", count: 1 }],
    offsets: cloneOffsets(startOffsets),
    move: null,
  }];

  let focusedPlate = 1;
  let offsets = cloneOffsets(startOffsets);

  moves.forEach((move, index) => {
    const targetPlate = links.length - move.plate;
    const keys = [];

    while (focusedPlate < targetPlate) {
      keys.push("W");
      focusedPlate += 1;
    }

    while (focusedPlate > targetPlate) {
      keys.push("S");
      focusedPlate -= 1;
    }

    keys.push(move.direction === "up" ? "A" : "D");

    const normalizedLink = links[move.plate];
    if (normalizedLink) {
      const change = getActionDelta(normalizedLink, move.delta);
      offsets = offsets.map((value, offsetIndex) => value + change[offsetIndex]);
    }

    chunks.push({
      id: `move-${index}`,
      type: "move",
      label: formatSolutionStepLabel(move, links.length),
      keys,
      keyGroups: groupConsecutiveKeys(keys),
      offsets: cloneOffsets(offsets),
      move,
    });
  });

  chunks.push({
    id: "solved",
    type: "solved",
    label: "Solved",
    keys: [],
    keyGroups: [{ key: "Solved", count: 1 }],
    offsets: cloneOffsets(offsets),
    move: null,
  });

  return chunks;
}

export function buildSolutionPlanForApp(
  state: Pick<AppStateData, "plateCount" | "links">,
  startOffsets: Offsets | null | undefined,
): SolutionPlanData {
  const { plateCount, links } = state;
  const start = Array.isArray(startOffsets)
    ? cloneOffsets(startOffsets)
    : Array.from({ length: plateCount }, () => 0);
  const targetKey = Array.from({ length: plateCount }, () => 0).join(",");
  const startKey = start.join(",");

  if (startKey === targetKey) {
    const moves: SolutionMoveData[] = [];
    return { moves, chunks: buildSolutionChunks(moves, start, links), index: 0, startOffsets: start };
  }

  const queue = [start];
  const parents = new Map<string, string | null>([[startKey, null]]);
  const moves = new Map<string, SolutionMoveData>();

  while (queue.length) {
    const current = queue.shift();
    const currentKey = current.join(",");

    for (let plate = 0; plate < plateCount; plate += 1) {
      const normalizedLink = links[plate];
      if (!normalizedLink) {
        continue;
      }

      for (const delta of [-1, 1]) {
        const change = getActionDelta(normalizedLink, delta);
        const next = current.map((value, index) => value + change[index]);

        if (next.some((value) => value < -CENTER_INDEX || value > CENTER_INDEX)) {
          continue;
        }

        const nextKey = next.join(",");
        if (parents.has(nextKey)) {
          continue;
        }

        parents.set(nextKey, currentKey);
        moves.set(nextKey, {
          plate,
          delta,
          direction: delta === -1 ? "up" : "down",
        });

        if (nextKey === targetKey) {
          const plan: SolutionMoveData[] = [];
          let traceKey = nextKey;

          while (traceKey !== startKey) {
            plan.unshift(moves.get(traceKey));
            traceKey = parents.get(traceKey);
          }

          return {
            moves: plan,
            chunks: buildSolutionChunks(plan, start, links),
            index: 0,
            startOffsets: start,
          };
        }

        queue.push(next);
      }
    }
  }

  return {
    moves: null,
    chunks: [
      {
        id: "reset",
        type: "reset",
        label: "R",
        keys: ["R"],
        keyGroups: [{ key: "R", count: 1 }],
        offsets: start,
        move: null,
      },
      {
        id: "solved",
        type: "solved",
        label: "Solved",
        keys: [],
        keyGroups: [{ key: "Solved", count: 1 }],
        offsets: start,
        move: null,
      },
    ],
    index: 0,
    startOffsets: start,
  };
}

export const buildSolutionPlan = buildSolutionPlanForApp;

export function buildSolutionCommandString(chunks: SolutionChunkData[] | null | undefined): string {
  return Array.isArray(chunks) && chunks.length ? chunks.flatMap((chunk) => chunk.keys).join("") : "";
}

export function buildWasdSequence(chunks: SolutionChunkData[] | null | undefined): Array<{ key: string; count: number; kind: "single" | "pattern" }> {
  if (!Array.isArray(chunks) || !chunks.length) {
    return [];
  }

  const commands = chunks.flatMap((chunk) => chunk.keys);
  const grouped = [];

  for (let index = 0; index < commands.length; ) {
    let singleCount = 1;
    while (index + singleCount < commands.length && commands[index + singleCount] === commands[index]) {
      singleCount += 1;
    }

    if (singleCount >= 2) {
      grouped.push({ key: commands[index], count: singleCount, kind: "single" });
      index += singleCount;
      continue;
    }

    const pair = commands.slice(index, index + 2);
    if (pair.length === 2 && pair[0] !== pair[1]) {
      let pairCount = 1;
      while (
        index + (pairCount * 2) + 1 < commands.length
        && commands[index + (pairCount * 2)] === pair[0]
        && commands[index + (pairCount * 2) + 1] === pair[1]
      ) {
        pairCount += 1;
      }

      if (pairCount >= 2) {
        grouped.push({ key: pair.join(""), count: pairCount, kind: "pattern" });
        index += pairCount * 2;
        continue;
      }
    }

    grouped.push({ key: commands[index], count: 1, kind: "single" });
    index += 1;
  }

  return grouped;
}
