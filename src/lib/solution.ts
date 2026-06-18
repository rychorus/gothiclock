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
    return "Reset the lock";
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

function invertMove(move: SolutionMoveData): SolutionMoveData {
  return {
    plate: move.plate,
    delta: -move.delta,
    direction: move.direction === "up" ? "down" : "up",
  };
}

function getOffsetsKey(offsets: Offsets) {
  return offsets.join(",");
}

function reconstructSolutionPlan(
  meetKey: string,
  startKey: string,
  targetKey: string,
  frontParents: Map<string, string | null>,
  frontMoves: Map<string, SolutionMoveData>,
  backParents: Map<string, string | null>,
  backMoves: Map<string, SolutionMoveData>,
  startOffsets: Offsets,
  links: PlateLinks,
): SolutionPlanData {
  const moves: SolutionMoveData[] = [];

  let traceKey: string | null = meetKey;
  while (traceKey && traceKey !== startKey) {
    const move = frontMoves.get(traceKey);
    const parentKey = frontParents.get(traceKey) ?? null;
    if (!move || !parentKey) {
      break;
    }

    moves.unshift(move);
    traceKey = parentKey;
  }

  traceKey = meetKey;
  while (traceKey && traceKey !== targetKey) {
    const move = backMoves.get(traceKey);
    const parentKey = backParents.get(traceKey) ?? null;
    if (!move || !parentKey) {
      break;
    }

    moves.push(move);
    traceKey = parentKey;
  }

  return {
    moves,
    chunks: buildSolutionChunks(moves, startOffsets, links),
    index: 0,
    startOffsets,
  };
}

function expandSolutionFrontier(
  frontier: Array<{ key: string; offsets: Offsets }>,
  visited: Map<string, string | null>,
  otherVisited: Map<string, string | null>,
  links: PlateLinks,
  plateCount: number,
  storeMove: (key: string, move: SolutionMoveData) => void,
): { meetKey: string | null; nextFrontier: Array<{ key: string; offsets: Offsets }> } {
  const nextFrontier: Array<{ key: string; offsets: Offsets }> = [];

  for (const node of frontier) {
    if (otherVisited.has(node.key)) {
      return { meetKey: node.key, nextFrontier };
    }

    for (let plate = 0; plate < plateCount; plate += 1) {
      const normalizedLink = links[plate];
      if (!normalizedLink) {
        continue;
      }

      for (const delta of [-1, 1] as const) {
        const nextOffsets = node.offsets.map((value, index) => value + (normalizedLink[index] * delta));

        if (nextOffsets.some((value) => value < -CENTER_INDEX || value > CENTER_INDEX)) {
          continue;
        }

        const nextKey = getOffsetsKey(nextOffsets);
        if (visited.has(nextKey)) {
          continue;
        }

        visited.set(nextKey, node.key);
        const move: SolutionMoveData = {
          plate,
          delta,
          direction: delta === -1 ? "up" : "down",
        };
        storeMove(nextKey, move);

        if (otherVisited.has(nextKey)) {
          return { meetKey: nextKey, nextFrontier };
        }

        nextFrontier.push({ key: nextKey, offsets: nextOffsets });
      }
    }
  }

  return { meetKey: null, nextFrontier };
}

export function buildSolutionPlanForApp(
  state: Pick<AppStateData, "plateCount" | "links">,
  startOffsets: Offsets | null | undefined,
): SolutionPlanData {
  const { plateCount, links } = state;
  const start = Array.isArray(startOffsets)
    ? cloneOffsets(startOffsets)
    : Array.from({ length: plateCount }, () => 0);
  const target = Array.from({ length: plateCount }, () => 0);
  const targetKey = getOffsetsKey(target);
  const startKey = start.join(",");

  if (startKey === targetKey) {
    const moves: SolutionMoveData[] = [];
    return { moves, chunks: buildSolutionChunks(moves, start, links), index: 0, startOffsets: start };
  }

  const frontParents = new Map<string, string | null>([[startKey, null]]);
  const frontMoves = new Map<string, SolutionMoveData>();
  const backParents = new Map<string, string | null>([[targetKey, null]]);
  const backMoves = new Map<string, SolutionMoveData>();
  let frontFrontier = [{ key: startKey, offsets: start }];
  let backFrontier = [{ key: targetKey, offsets: target }];

  while (frontFrontier.length && backFrontier.length) {
    if (frontFrontier.length <= backFrontier.length) {
      const { meetKey, nextFrontier } = expandSolutionFrontier(
        frontFrontier,
        frontParents,
        backParents,
        links,
        plateCount,
        (key, move) => frontMoves.set(key, move),
      );

      if (meetKey) {
        return reconstructSolutionPlan(meetKey, startKey, targetKey, frontParents, frontMoves, backParents, backMoves, start, links);
      }

      frontFrontier = nextFrontier;
      continue;
    }

    const { meetKey, nextFrontier } = expandSolutionFrontier(
      backFrontier,
      backParents,
      frontParents,
      links,
      plateCount,
      (key, move) => backMoves.set(key, invertMove(move)),
    );

    if (meetKey) {
      return reconstructSolutionPlan(meetKey, startKey, targetKey, frontParents, frontMoves, backParents, backMoves, start, links);
    }

    backFrontier = nextFrontier;
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
