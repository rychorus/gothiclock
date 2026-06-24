import { CENTER_INDEX, MAX_PLATES, MIN_PLATES, createIdentityLink } from "./lockData";
import type { Offsets, PlateLink, PlateLinks } from "./types";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const MAX_SPARSE_EDGES = 12;

type ParsedCompactLock = {
  plateCount: number;
  offsets: Offsets;
  links: PlateLinks;
};

type CompactState = {
  plateCount: number;
  offsets: Offsets;
  links: PlateLinks;
};

type SignedGroup = Array<{ plate: number; sign: 1 | -1 }>;
type SignedPartition = {
  key: string;
  groups: SignedGroup[];
};

const combinationMemo = new Map<string, bigint>();
const signedPartitionMemo = new Map<number, SignedPartition[]>();
const signedPartitionIndexMemo = new Map<number, Map<string, number>>();

function pow(base: number | bigint, exponent: number): bigint {
  return BigInt(base) ** BigInt(exponent);
}

function combination(n: number, k: number): bigint {
  if (k < 0 || k > n) {
    return 0n;
  }

  if (k === 0 || k === n) {
    return 1n;
  }

  const normalizedK = Math.min(k, n - k);
  const key = `${n},${normalizedK}`;
  const cached = combinationMemo.get(key);
  if (cached !== undefined) {
    return cached;
  }

  let result = 1n;
  for (let index = 1; index <= normalizedK; index += 1) {
    result = (result * BigInt(n - normalizedK + index)) / BigInt(index);
  }

  combinationMemo.set(key, result);
  return result;
}

function toBase64Url(value: bigint): string {
  if (value === 0n) {
    return ALPHABET[0];
  }

  let remaining = value;
  let output = "";
  while (remaining > 0n) {
    output = ALPHABET[Number(remaining % 64n)] + output;
    remaining /= 64n;
  }

  return output;
}

function fromBase64Url(token: string): bigint | null {
  const trimmed = token.trim();
  if (!trimmed || !/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    return null;
  }

  let value = 0n;
  for (const character of trimmed) {
    const digit = ALPHABET.indexOf(character);
    if (digit < 0) {
      return null;
    }

    value = (value * 64n) + BigInt(digit);
  }

  return value;
}

function getPositionForPlate(state: CompactState, plate: number): number {
  return CENTER_INDEX + 1 - (state.offsets[state.plateCount - plate] ?? 0);
}

function getOffsetFromPosition(position: number): number {
  return CENTER_INDEX + 1 - position;
}

function getPositionsByPlate(state: CompactState): number[] {
  return Array.from({ length: state.plateCount }, (_, index) => getPositionForPlate(state, index + 1));
}

function rankPositions(positions: number[]): bigint {
  return positions.reduce((rank, position) => (rank * 7n) + BigInt(position - 1), 0n);
}

function unrankPositions(plateCount: number, rank: bigint): number[] {
  let remaining = rank;
  const positions = Array.from({ length: plateCount }, () => 1);
  for (let index = plateCount - 1; index >= 0; index -= 1) {
    positions[index] = Number(remaining % 7n) + 1;
    remaining /= 7n;
  }

  return positions;
}

function offsetsFromPositions(plateCount: number, positions: number[]): Offsets {
  return Array.from({ length: plateCount }, (_, index) => {
    const plate = plateCount - index;
    return getOffsetFromPosition(positions[plate - 1]);
  });
}

function createEmptyLinks(plateCount: number): PlateLinks {
  return Array.from({ length: plateCount }, () => null);
}

function getLinkForPlate(links: PlateLinks, plateCount: number, plate: number): PlateLink | null {
  return links[plateCount - plate] ?? null;
}

function getRelationByPlate(link: PlateLink, plateCount: number, plate: number): number {
  return link[plateCount - plate] ?? 0;
}

function setLinkForPlate(links: PlateLinks, plateCount: number, plate: number, link: PlateLink) {
  links[plateCount - plate] = link;
}

function getDirectedSlot(plateCount: number, sourcePlate: number, targetPlate: number): number {
  let slot = 0;
  for (let source = 1; source <= plateCount; source += 1) {
    for (let target = 1; target <= plateCount; target += 1) {
      if (source === target) {
        continue;
      }

      if (source === sourcePlate && target === targetPlate) {
        return slot;
      }

      slot += 1;
    }
  }

  return -1;
}

function getDirectedSlotPlates(plateCount: number, slot: number): { sourcePlate: number; targetPlate: number } {
  let currentSlot = 0;
  for (let source = 1; source <= plateCount; source += 1) {
    for (let target = 1; target <= plateCount; target += 1) {
      if (source === target) {
        continue;
      }

      if (currentSlot === slot) {
        return { sourcePlate: source, targetPlate: target };
      }

      currentSlot += 1;
    }
  }

  throw new Error("Invalid compact link slot.");
}

function rankCombinationColex(selected: number[]): bigint {
  return selected.reduce((rank, value, index) => rank + combination(value, index + 1), 0n);
}

function unrankCombinationColex(size: number, count: number, rank: bigint): number[] {
  let remaining = rank;
  const selected = Array.from({ length: count }, () => 0);
  let candidate = size - 1;

  for (let index = count; index >= 1; index -= 1) {
    while (combination(candidate, index) > remaining) {
      candidate -= 1;
    }

    selected[index - 1] = candidate;
    remaining -= combination(candidate, index);
    candidate -= 1;
  }

  return selected;
}

function sparseEdgePrefix(slotCount: number, edgeCount: number, extraBitCount = 0): bigint {
  let prefix = 0n;
  for (let count = 0; count < edgeCount; count += 1) {
    prefix += combination(slotCount, count) * pow(2, count + extraBitCount);
  }

  return prefix;
}

function limitedSparseEdgeStateCount(slotCount: number, extraBitCount = 0): bigint {
  const maxEdges = Math.min(MAX_SPARSE_EDGES, slotCount);
  return sparseEdgePrefix(slotCount, maxEdges + 1, extraBitCount);
}

function rankSparseEdges(slotCount: number, selectedSlots: number[], signBits: bigint, extraBits = 0n, extraBitCount = 0): bigint {
  const edgeCount = selectedSlots.length;
  return sparseEdgePrefix(slotCount, edgeCount, extraBitCount)
    + (rankCombinationColex(selectedSlots) * pow(2, edgeCount + extraBitCount))
    + (signBits * pow(2, extraBitCount))
    + extraBits;
}

function unrankSparseEdges(slotCount: number, rank: bigint, extraBitCount = 0) {
  let edgeCount = 0;
  let prefix = 0n;

  while (edgeCount <= Math.min(MAX_SPARSE_EDGES, slotCount)) {
    const bucketSize = combination(slotCount, edgeCount) * pow(2, edgeCount + extraBitCount);
    if (rank < prefix + bucketSize) {
      const local = rank - prefix;
      const extraModulo = pow(2, extraBitCount);
      const extraBits = extraBitCount > 0 ? local % extraModulo : 0n;
      const signedEdgeRank = extraBitCount > 0 ? local / extraModulo : local;
      const signModulo = pow(2, edgeCount);
      const signBits = signedEdgeRank % signModulo;
      const combinationRank = signedEdgeRank / signModulo;
      return {
        selectedSlots: unrankCombinationColex(slotCount, edgeCount, combinationRank),
        signBits,
        extraBits,
      };
    }

    prefix += bucketSize;
    edgeCount += 1;
  }

  throw new Error("Compact sparse link rank is out of range.");
}

function getSparseEdges(state: CompactState) {
  const edges: Array<{ slot: number; relation: 1 | -1 }> = [];
  let knownMask = 0;

  for (let source = 1; source <= state.plateCount; source += 1) {
    const link = getLinkForPlate(state.links, state.plateCount, source);
    if (!link) {
      continue;
    }

    knownMask |= 1 << (source - 1);
    for (let target = 1; target <= state.plateCount; target += 1) {
      if (source === target) {
        continue;
      }

      const relation = getRelationByPlate(link, state.plateCount, target);
      if (relation !== 1 && relation !== -1) {
        continue;
      }

      edges.push({
        slot: getDirectedSlot(state.plateCount, source, target),
        relation,
      });
    }
  }

  edges.sort((left, right) => left.slot - right.slot);
  return { edges, knownMask };
}

function encodeSparseEdgeState(state: CompactState, includeKnownMask: boolean): bigint | null {
  const slotCount = state.plateCount * (state.plateCount - 1);
  const { edges, knownMask } = getSparseEdges(state);
  if (edges.length > MAX_SPARSE_EDGES) {
    return null;
  }

  let signBits = 0n;
  edges.forEach((edge, index) => {
    if (edge.relation === -1) {
      signBits |= 1n << BigInt(index);
    }
  });

  return rankSparseEdges(
    slotCount,
    edges.map((edge) => edge.slot),
    signBits,
    includeKnownMask ? BigInt(knownMask) : 0n,
    includeKnownMask ? state.plateCount : 0,
  );
}

function decodeSparseEdgeState(plateCount: number, rank: bigint, includeKnownMask: boolean): PlateLinks {
  const slotCount = plateCount * (plateCount - 1);
  const { selectedSlots, signBits, extraBits } = unrankSparseEdges(slotCount, rank, includeKnownMask ? plateCount : 0);
  let knownMask = includeKnownMask ? Number(extraBits) : (1 << plateCount) - 1;

  selectedSlots.forEach((slot) => {
    const { sourcePlate } = getDirectedSlotPlates(plateCount, slot);
    knownMask |= 1 << (sourcePlate - 1);
  });

  const links = createEmptyLinks(plateCount);
  for (let source = 1; source <= plateCount; source += 1) {
    if ((knownMask & (1 << (source - 1))) !== 0) {
      setLinkForPlate(links, plateCount, source, createIdentityLink(plateCount, plateCount - source));
    }
  }

  selectedSlots.forEach((slot, index) => {
    const { sourcePlate, targetPlate } = getDirectedSlotPlates(plateCount, slot);
    const link = getLinkForPlate(links, plateCount, sourcePlate) || createIdentityLink(plateCount, plateCount - sourcePlate);
    link[plateCount - targetPlate] = ((signBits >> BigInt(index)) & 1n) === 1n ? -1 : 1;
    setLinkForPlate(links, plateCount, sourcePlate, link);
  });

  return links;
}

function generatePartitions(plateCount: number): number[][][] {
  const restrictedGrowth = Array.from({ length: plateCount }, () => 0);
  const partitions: number[][][] = [];

  function visit(index: number, maxBlock: number) {
    if (index === plateCount) {
      const blocks = Array.from({ length: maxBlock + 1 }, () => [] as number[]);
      restrictedGrowth.forEach((block, plateIndex) => blocks[block].push(plateIndex + 1));
      partitions.push(blocks);
      return;
    }

    for (let block = 0; block <= maxBlock + 1; block += 1) {
      restrictedGrowth[index] = block;
      visit(index + 1, Math.max(maxBlock, block));
    }
  }

  visit(1, 0);
  return partitions;
}

function getBlockSignVariants(block: number[]): SignedGroup[] {
  if (block.length <= 1) {
    return [[{ plate: block[0], sign: 1 }]];
  }

  const rest = block.slice(1);
  const variants: SignedGroup[] = [];
  const variantCount = 1 << rest.length;

  for (let mask = 0; mask < variantCount; mask += 1) {
    variants.push([
      { plate: block[0], sign: 1 },
      ...rest.map((plate, index) => ({
        plate,
        sign: ((mask >> index) & 1) === 1 ? -1 as const : 1 as const,
      })),
    ]);
  }

  return variants;
}

function cartesianGroups(groups: SignedGroup[][]): SignedGroup[][] {
  return groups.reduce<SignedGroup[][]>((accumulator, variants) => (
    accumulator.flatMap((prefix) => variants.map((variant) => [...prefix, variant]))
  ), [[]]);
}

function getPartitionKey(groups: SignedGroup[]): string {
  return groups
    .map((group) => [...group].sort((left, right) => left.plate - right.plate))
    .sort((left, right) => left[0].plate - right[0].plate)
    .map((group) => group.map(({ plate, sign }) => `${plate}${sign === -1 ? "-" : "+"}`).join(","))
    .join("|");
}

function getSignedPartitions(plateCount: number): SignedPartition[] {
  const cached = signedPartitionMemo.get(plateCount);
  if (cached) {
    return cached;
  }

  const partitions = generatePartitions(plateCount)
    .flatMap((partition) => cartesianGroups(partition.map(getBlockSignVariants)))
    .map((groups) => ({
      groups: groups
        .map((group) => [...group].sort((left, right) => left.plate - right.plate))
        .sort((left, right) => left[0].plate - right[0].plate),
      key: getPartitionKey(groups),
    }))
    .sort((left, right) => left.key.localeCompare(right.key));

  signedPartitionMemo.set(plateCount, partitions);
  signedPartitionIndexMemo.set(plateCount, new Map(partitions.map((partition, index) => [partition.key, index])));
  return partitions;
}

function getSignedPartitionIndex(plateCount: number): Map<string, number> {
  getSignedPartitions(plateCount);
  return signedPartitionIndexMemo.get(plateCount)!;
}

function getPhysicalCount(plateCount: number): bigint {
  return pow(7, plateCount) * BigInt(getSignedPartitions(plateCount).length);
}

function getPhysicalTotal(): bigint {
  let total = 0n;
  for (let plateCount = MIN_PLATES; plateCount <= MAX_PLATES; plateCount += 1) {
    total += getPhysicalCount(plateCount);
  }

  return total;
}

function getSetupOnlyCount(plateCount: number): bigint {
  return pow(7, plateCount);
}

function getSetupOnlyTotal(): bigint {
  let total = 0n;
  for (let plateCount = MIN_PLATES; plateCount <= MAX_PLATES; plateCount += 1) {
    total += getSetupOnlyCount(plateCount);
  }

  return total;
}

function getSetupOnlyPrefix(plateCount: number): bigint {
  let prefix = 0n;
  for (let current = MIN_PLATES; current < plateCount; current += 1) {
    prefix += getSetupOnlyCount(current);
  }

  return prefix;
}

function getPhysicalPrefix(plateCount: number): bigint {
  let prefix = getSetupOnlyTotal();
  for (let current = MIN_PLATES; current < plateCount; current += 1) {
    prefix += getPhysicalCount(current);
  }

  return prefix;
}

function getCompleteSparseCount(plateCount: number): bigint {
  const slotCount = plateCount * (plateCount - 1);
  return pow(7, plateCount) * limitedSparseEdgeStateCount(slotCount);
}

function getCompleteSparsePrefix(plateCount: number): bigint {
  let prefix = getSetupOnlyTotal() + getPhysicalTotal();
  for (let current = MIN_PLATES; current < plateCount; current += 1) {
    prefix += getCompleteSparseCount(current);
  }

  return prefix;
}

function getCompleteSparseTotal(): bigint {
  let total = 0n;
  for (let plateCount = MIN_PLATES; plateCount <= MAX_PLATES; plateCount += 1) {
    total += getCompleteSparseCount(plateCount);
  }

  return total;
}

function getPartialSparseCount(plateCount: number): bigint {
  const slotCount = plateCount * (plateCount - 1);
  return pow(7, plateCount) * limitedSparseEdgeStateCount(slotCount, plateCount);
}

function getPartialSparsePrefix(plateCount: number): bigint {
  let prefix = getSetupOnlyTotal() + getPhysicalTotal() + getCompleteSparseTotal();
  for (let current = MIN_PLATES; current < plateCount; current += 1) {
    prefix += getPartialSparseCount(current);
  }

  return prefix;
}

function getPartialSparseTotal(): bigint {
  let total = 0n;
  for (let plateCount = MIN_PLATES; plateCount <= MAX_PLATES; plateCount += 1) {
    total += getPartialSparseCount(plateCount);
  }

  return total;
}

function getExactRowBase(plateCount: number): bigint {
  return 1n + pow(3, plateCount - 1);
}

function getExactCount(plateCount: number): bigint {
  return pow(7, plateCount) * (getExactRowBase(plateCount) ** BigInt(plateCount));
}

function getExactPrefix(plateCount: number): bigint {
  let prefix = getSetupOnlyTotal() + getPhysicalTotal() + getCompleteSparseTotal() + getPartialSparseTotal();
  for (let current = MIN_PLATES; current < plateCount; current += 1) {
    prefix += getExactCount(current);
  }

  return prefix;
}

function tryGetPhysicalGroups(state: CompactState): SignedGroup[] | null {
  if (state.links.length !== state.plateCount || state.links.some((link) => !link)) {
    return null;
  }

  const adjacency = Array.from({ length: state.plateCount + 1 }, () => [] as Array<{ plate: number; relation: 1 | -1 }>);
  for (let source = 1; source <= state.plateCount; source += 1) {
    const link = getLinkForPlate(state.links, state.plateCount, source);
    if (!link) {
      return null;
    }

    for (let target = 1; target <= state.plateCount; target += 1) {
      if (source === target) {
        continue;
      }

      const relation = getRelationByPlate(link, state.plateCount, target);
      if (relation !== 1 && relation !== -1) {
        continue;
      }

      adjacency[source].push({ plate: target, relation });
      adjacency[target].push({ plate: source, relation });
    }
  }

  const signs: Array<1 | -1 | null> = Array.from({ length: state.plateCount + 1 }, () => null);
  for (let start = 1; start <= state.plateCount; start += 1) {
    if (signs[start] !== null) {
      continue;
    }

    signs[start] = 1;
    const queue = [start];
    while (queue.length) {
      const current = queue.shift()!;
      for (const edge of adjacency[current]) {
        const nextSign = (signs[current]! * edge.relation) as 1 | -1;
        if (signs[edge.plate] === null) {
          signs[edge.plate] = nextSign;
          queue.push(edge.plate);
        } else if (signs[edge.plate] !== nextSign) {
          return null;
        }
      }
    }
  }

  const visited = new Set<number>();
  const groups: SignedGroup[] = [];
  for (let start = 1; start <= state.plateCount; start += 1) {
    if (visited.has(start)) {
      continue;
    }

    const group: SignedGroup = [];
    const queue = [start];
    visited.add(start);

    while (queue.length) {
      const current = queue.shift()!;
      group.push({ plate: current, sign: signs[current] || 1 });
      for (const edge of adjacency[current]) {
        if (!visited.has(edge.plate)) {
          visited.add(edge.plate);
          queue.push(edge.plate);
        }
      }
    }

    const rootSign = group.sort((left, right) => left.plate - right.plate)[0].sign;
    groups.push(group.map(({ plate, sign }) => ({ plate, sign: (sign * rootSign) as 1 | -1 })));
  }

  return groups;
}

function encodePhysical(state: CompactState): bigint | null {
  const groups = tryGetPhysicalGroups(state);
  if (!groups) {
    return null;
  }

  const partitionIndex = getSignedPartitionIndex(state.plateCount).get(getPartitionKey(groups));
  if (partitionIndex === undefined) {
    return null;
  }

  return getPhysicalPrefix(state.plateCount)
    + (rankPositions(getPositionsByPlate(state)) * BigInt(getSignedPartitions(state.plateCount).length))
    + BigInt(partitionIndex);
}

function decodePhysical(rank: bigint): ParsedCompactLock | null {
  let prefix = getSetupOnlyTotal();
  for (let plateCount = MIN_PLATES; plateCount <= MAX_PLATES; plateCount += 1) {
    const count = getPhysicalCount(plateCount);
    if (rank >= prefix && rank < prefix + count) {
      const local = rank - prefix;
      const partitions = getSignedPartitions(plateCount);
      const positionRank = local / BigInt(partitions.length);
      const partition = partitions[Number(local % BigInt(partitions.length))];
      const links = createEmptyLinks(plateCount);

      partition.groups.forEach((group) => {
        group.forEach((source) => {
          const link = createIdentityLink(plateCount, plateCount - source.plate);
          group.forEach((target) => {
            link[plateCount - target.plate] = (source.sign * target.sign) as 1 | -1;
          });
          setLinkForPlate(links, plateCount, source.plate, link);
        });
      });

      return {
        plateCount,
        offsets: offsetsFromPositions(plateCount, unrankPositions(plateCount, positionRank)),
        links,
      };
    }

    prefix += count;
  }

  return null;
}

function encodeSetupOnly(state: CompactState): bigint | null {
  if (state.links.some((link) => link)) {
    return null;
  }

  return getSetupOnlyPrefix(state.plateCount) + rankPositions(getPositionsByPlate(state));
}

function decodeSetupOnly(rank: bigint): ParsedCompactLock | null {
  let prefix = 0n;
  for (let plateCount = MIN_PLATES; plateCount <= MAX_PLATES; plateCount += 1) {
    const count = getSetupOnlyCount(plateCount);
    if (rank >= prefix && rank < prefix + count) {
      return {
        plateCount,
        offsets: offsetsFromPositions(plateCount, unrankPositions(plateCount, rank - prefix)),
        links: createEmptyLinks(plateCount),
      };
    }

    prefix += count;
  }

  return null;
}

function hasAllLinksKnown(state: CompactState): boolean {
  return state.links.length === state.plateCount && state.links.every(Boolean);
}

function encodeCompleteSparse(state: CompactState): bigint | null {
  if (!hasAllLinksKnown(state)) {
    return null;
  }

  const edgeRank = encodeSparseEdgeState(state, false);
  if (edgeRank === null) {
    return null;
  }

  return getCompleteSparsePrefix(state.plateCount)
    + (edgeRank * pow(7, state.plateCount))
    + rankPositions(getPositionsByPlate(state));
}

function decodeSparseMode(rank: bigint, includeKnownMask: boolean): ParsedCompactLock | null {
  let prefix = includeKnownMask
    ? getSetupOnlyTotal() + getPhysicalTotal() + getCompleteSparseTotal()
    : getSetupOnlyTotal() + getPhysicalTotal();
  for (let plateCount = MIN_PLATES; plateCount <= MAX_PLATES; plateCount += 1) {
    const count = includeKnownMask ? getPartialSparseCount(plateCount) : getCompleteSparseCount(plateCount);
    if (rank >= prefix && rank < prefix + count) {
      const local = rank - prefix;
      const positionSpace = pow(7, plateCount);
      return {
        plateCount,
        offsets: offsetsFromPositions(plateCount, unrankPositions(plateCount, local % positionSpace)),
        links: decodeSparseEdgeState(plateCount, local / positionSpace, includeKnownMask),
      };
    }

    prefix += count;
  }

  return null;
}

function encodePartialSparse(state: CompactState): bigint | null {
  const edgeRank = encodeSparseEdgeState(state, true);
  if (edgeRank === null) {
    return null;
  }

  return getPartialSparsePrefix(state.plateCount)
    + (edgeRank * pow(7, state.plateCount))
    + rankPositions(getPositionsByPlate(state));
}

function rankExactRow(plateCount: number, sourcePlate: number, link: PlateLink): bigint {
  let rank = 0n;
  for (let target = 1; target <= plateCount; target += 1) {
    if (target === sourcePlate) {
      continue;
    }

    const relation = getRelationByPlate(link, plateCount, target);
    rank = (rank * 3n) + BigInt(relation === -1 ? 2 : relation === 1 ? 1 : 0);
  }

  return rank;
}

function decodeExactRow(plateCount: number, sourcePlate: number, rank: bigint): PlateLink {
  let remaining = rank;
  const digits: number[] = [];
  for (let index = 0; index < plateCount - 1; index += 1) {
    digits.unshift(Number(remaining % 3n));
    remaining /= 3n;
  }

  const link = createIdentityLink(plateCount, plateCount - sourcePlate);
  let digitIndex = 0;
  for (let target = 1; target <= plateCount; target += 1) {
    if (target === sourcePlate) {
      continue;
    }

    const digit = digits[digitIndex];
    link[plateCount - target] = digit === 2 ? -1 : digit === 1 ? 1 : 0;
    digitIndex += 1;
  }

  return link;
}

function encodeExact(state: CompactState): bigint {
  const rowBase = getExactRowBase(state.plateCount);
  let linkRank = 0n;
  for (let source = 1; source <= state.plateCount; source += 1) {
    const link = getLinkForPlate(state.links, state.plateCount, source);
    const rowState = link ? 1n + rankExactRow(state.plateCount, source, link) : 0n;
    linkRank = (linkRank * rowBase) + rowState;
  }

  return getExactPrefix(state.plateCount)
    + (((rankPositions(getPositionsByPlate(state)) * (rowBase ** BigInt(state.plateCount))) + linkRank));
}

function decodeExact(rank: bigint): ParsedCompactLock | null {
  let prefix = getSetupOnlyTotal() + getPhysicalTotal() + getCompleteSparseTotal() + getPartialSparseTotal();
  for (let plateCount = MIN_PLATES; plateCount <= MAX_PLATES; plateCount += 1) {
    const count = getExactCount(plateCount);
    if (rank >= prefix && rank < prefix + count) {
      const local = rank - prefix;
      const rowBase = getExactRowBase(plateCount);
      const linkSpace = rowBase ** BigInt(plateCount);
      const positions = unrankPositions(plateCount, local / linkSpace);
      let linkRank = local % linkSpace;
      const rowStates = Array.from({ length: plateCount }, () => 0n);
      for (let index = plateCount - 1; index >= 0; index -= 1) {
        rowStates[index] = linkRank % rowBase;
        linkRank /= rowBase;
      }

      const links = createEmptyLinks(plateCount);
      rowStates.forEach((rowState, index) => {
        if (rowState === 0n) {
          return;
        }

        const sourcePlate = index + 1;
        setLinkForPlate(links, plateCount, sourcePlate, decodeExactRow(plateCount, sourcePlate, rowState - 1n));
      });

      return {
        plateCount,
        offsets: offsetsFromPositions(plateCount, positions),
        links,
      };
    }

    prefix += count;
  }

  return null;
}

function isCompactStateValid(state: CompactState): boolean {
  return Number.isInteger(state.plateCount)
    && state.plateCount >= MIN_PLATES
    && state.plateCount <= MAX_PLATES
    && state.offsets.length >= state.plateCount
    && state.offsets.slice(0, state.plateCount).every((offset) => Number.isInteger(offset) && offset >= -CENTER_INDEX && offset <= CENTER_INDEX);
}

export function encodeCompactLock(state: CompactState): string {
  if (!isCompactStateValid(state)) {
    return "";
  }

  const normalizedState = {
    plateCount: state.plateCount,
    offsets: state.offsets.slice(0, state.plateCount),
    links: Array.from({ length: state.plateCount }, (_, index) => state.links[index] ? [...state.links[index]!] : null),
  };
  const rank = encodeSetupOnly(normalizedState)
    ?? encodePhysical(normalizedState)
    ?? encodeCompleteSparse(normalizedState)
    ?? encodePartialSparse(normalizedState)
    ?? encodeExact(normalizedState);

  return toBase64Url(rank);
}

export function decodeCompactLock(token: string): ParsedCompactLock | null {
  const rank = fromBase64Url(token);
  if (rank === null) {
    return null;
  }

  if (rank < getSetupOnlyTotal()) {
    return decodeSetupOnly(rank);
  }

  if (rank < getSetupOnlyTotal() + getPhysicalTotal()) {
    return decodePhysical(rank);
  }

  if (rank < getSetupOnlyTotal() + getPhysicalTotal() + getCompleteSparseTotal()) {
    return decodeSparseMode(rank, false);
  }

  if (rank < getSetupOnlyTotal() + getPhysicalTotal() + getCompleteSparseTotal() + getPartialSparseTotal()) {
    return decodeSparseMode(rank, true);
  }

  return decodeExact(rank);
}
