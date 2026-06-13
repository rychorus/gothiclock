import { CENTER_INDEX, cloneOffsets } from "../../../../lib/lockData";
import { PlateLinkingState, SolutionChunk, SolutionKeyGroup, SolutionMove, SolutionPlan, StartOffsets } from "../../model";

export function getActionDelta(normalizedLink, delta) {
  return normalizedLink.map((value) => value * delta);
}

export function groupConsecutiveKeys(keys) {
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

export function formatKeyGroups(groups) {
  return groups.map(({ key, count }) => (count > 1 ? `${key}\u00d7${count}` : key)).join(" ");
}

export function buildSolutionChunks(moves, startOffsets, links) {
  const chunks = [
    new SolutionChunk({
      id: "reset",
      type: "reset",
      label: "R",
      keys: ["R"],
      keyGroups: [new SolutionKeyGroup({ key: "R" })],
      offsets: cloneOffsets(startOffsets),
    }),
  ];

  // Solution steps are expressed in the visible plate numbering,
  // where the bottom plate is 1 and plates count upward from there.
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

    const change = getActionDelta(links[move.plate], move.delta);
    offsets = offsets.map((value, offsetIndex) => value + change[offsetIndex]);

    chunks.push(new SolutionChunk({
      id: `move-${index}`,
      type: "move",
      label: formatKeyGroups(groupConsecutiveKeys(keys)),
      keys,
      keyGroups: groupConsecutiveKeys(keys).map((entry) => new SolutionKeyGroup(entry)),
      offsets: cloneOffsets(offsets),
      move,
    }));
  });

  chunks.push(new SolutionChunk({
    id: "solved",
    type: "solved",
    label: "Solved",
    keys: [],
    keyGroups: [new SolutionKeyGroup({ key: "Solved" })],
    offsets: cloneOffsets(offsets),
  }));

  return chunks;
}

function toStartOffsetArray(startOffsets, plateCount) {
  if (Array.isArray(startOffsets)) {
    return cloneOffsets(startOffsets);
  }

  if (Array.isArray(startOffsets?.values)) {
    return cloneOffsets(startOffsets.values);
  }

  if (startOffsets instanceof StartOffsets) {
    return cloneOffsets(startOffsets.values);
  }

  return Array.from({ length: plateCount }, () => 0);
}

export function buildSolutionPlan(initialState, startOffsets) {
  const state = initialState instanceof PlateLinkingState ? initialState : new PlateLinkingState(initialState);
  const { plateCount, links } = state;
  const start = toStartOffsetArray(startOffsets, plateCount);
  const targetKey = Array.from({ length: plateCount }, () => 0).join(",");
  const startKey = start.join(",");

  if (startKey === targetKey) {
    const moves = [];
    return new SolutionPlan({ moves, chunks: buildSolutionChunks(moves, start, links), index: 0, startOffsets: start });
  }

  const queue = [start];
  const parents = new Map([[startKey, null]]);
  const moves = new Map();

  while (queue.length) {
    const current = queue.shift();
    const currentKey = current.join(",");

    for (let plate = 0; plate < plateCount; plate += 1) {
      const normalizedLink = links[plate];
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
        moves.set(nextKey, new SolutionMove({
          plate,
          delta,
          direction: delta === -1 ? "up" : "down",
        }));

        if (nextKey === targetKey) {
          const plan = [];
          let traceKey = nextKey;

          while (traceKey !== startKey) {
            plan.unshift(moves.get(traceKey));
            traceKey = parents.get(traceKey);
          }

          return new SolutionPlan({ moves: plan, chunks: buildSolutionChunks(plan, start, links), index: 0, startOffsets: start });
        }

        queue.push(next);
      }
    }
  }

  return new SolutionPlan({
    moves: null,
    chunks: [
      new SolutionChunk({
        id: "reset",
        type: "reset",
        label: "R",
        keys: ["R"],
        keyGroups: [new SolutionKeyGroup({ key: "R" })],
        offsets: start,
      }),
      new SolutionChunk({
        id: "solved",
        type: "solved",
        label: "Solved",
        keys: [],
        keyGroups: [new SolutionKeyGroup({ key: "Solved" })],
        offsets: start,
      }),
    ],
    index: 0,
    startOffsets: start,
  });
}

export function buildSolutionCommandString(chunks) {
  return Array.isArray(chunks) && chunks.length ? chunks.flatMap((chunk) => chunk.keys).join("") : "";
}

export function buildWasdSequence(chunks) {
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
        index + (pairCount * 2) + 1 < commands.length &&
        commands[index + (pairCount * 2)] === pair[0] &&
        commands[index + (pairCount * 2) + 1] === pair[1]
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
