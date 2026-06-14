import { createIdentityLink } from "./lockData";

type ParsedSetupToken = {
  plateNumber: number;
  offset: number | null;
};

type ParsedLinkToken = {
  plateNumber: number;
  targetsText: string;
};

type ParsedLinkTarget = {
  plateNumber: number;
  relation: number;
};

export function getVisiblePlateLabel(index: number, plateCount: number) {
  return `P${plateCount - index}`;
}

function formatPosition(offset: number) {
  return `${4 - offset}`;
}

function isIdentityLink(link: Array<number> | null, source: number) {
  return Boolean(link)
    && link[source] === 1
    && link.every((value, index) => (index === source ? value === 1 : value === 0));
}

function parsePosition(token: string): number | null {
  const position = Number.parseInt(token, 10);
  if (!Number.isInteger(position) || position < 1 || position > 7) {
    return null;
  }

  return 4 - position;
}

function formatLinkTarget(label: string, relation: number) {
  return relation === -1 ? `${label}-` : label;
}

function formatLinkSource(label: string, targets: string[]) {
  if (!targets.length) {
    return `${label}>`;
  }

  return `${label}>${targets.join(",")}`;
}

export function buildNotationString(state: any) {
  const plateCount = state.plateCount || 0;
  if (!plateCount) {
    return "";
  }

  const setupParts = [];
  for (let index = 0; index < plateCount; index += 1) {
    setupParts.push(`${getVisiblePlateLabel(index, plateCount)}=${formatPosition(state.offsets?.[index] ?? 0)}`);
  }

  const linkParts = [];
  for (let source = 0; source < plateCount; source += 1) {
    const link = state.links?.[source];
    if (!link) {
      continue;
    }

    const targets = [];
    if (!isIdentityLink(link, source)) {
      for (let target = plateCount - 1; target >= 0; target -= 1) {
        if (target === source) {
          continue;
        }

        const relation = link[target];
        if (!relation) {
          continue;
        }

        targets.push(formatLinkTarget(getVisiblePlateLabel(target, plateCount), relation));
      }
    }

    linkParts.push(formatLinkSource(getVisiblePlateLabel(source, plateCount), targets));
  }

  return [
    setupParts.join(" "),
    "",
    linkParts.join(" "),
  ].join("\n");
}

function parseSetupToken(token: string): ParsedSetupToken | null {
  const match = token.match(/^P(\d+)=(\d+)$/i);
  if (!match) {
    return null;
  }

  return {
    plateNumber: Number.parseInt(match[1], 10),
    offset: parsePosition(match[2]),
  };
}

function parseLinkToken(token: string): ParsedLinkToken | null {
  const match = token.match(/^P(\d+)>(.*)$/i);
  if (!match) {
    return null;
  }

  return {
    plateNumber: Number.parseInt(match[1], 10),
    targetsText: match[2],
  };
}

function parseLinkTarget(token: string): ParsedLinkTarget | null {
  const match = token.match(/^P(\d+)([+-])?$/i);
  if (!match) {
    return null;
  }

  return {
    plateNumber: Number.parseInt(match[1], 10),
    relation: match[2] === "-" ? -1 : 1,
  };
}

function isParsedLinkTarget(value: ParsedLinkTarget | null): value is ParsedLinkTarget {
  return Boolean(value && typeof value.plateNumber === "number" && typeof value.relation === "number");
}

export function parseNotationString(text) {
  const sections = String(text || "")
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map((section) => section.trim())
    .filter((section) => section.length > 0);

  if (!sections.length) {
    throw new Error("Paste notation first.");
  }

  const setupTokens = sections[0].split(/\s+/).filter(Boolean);
  const setupEntries = setupTokens.map(parseSetupToken);
  if (setupEntries.some((entry) => !entry)) {
    throw new Error("The first line must use plate positions like `P1=4`.");
  }

  const linkTokens = sections[1] ? sections[1].split(/\s+/).filter(Boolean) : [];
  const linkEntries = linkTokens.map(parseLinkToken);
  if (linkEntries.some((entry) => !entry)) {
    throw new Error("The second line must use links like `P1>P2,P3-` or `P1>`.");
  }

  const plateNumbers = new Set<number>();
  setupEntries.forEach(({ plateNumber }) => plateNumbers.add(plateNumber));
  linkEntries.forEach(({ plateNumber, targetsText }) => {
    plateNumbers.add(plateNumber);
    targetsText.split(",").map((target) => target.trim()).filter(Boolean).forEach((targetToken) => {
      const target = parseLinkTarget(targetToken);
      if (!isParsedLinkTarget(target)) {
        throw new Error("Link targets must look like `P2` or `P2-`.");
      }
      plateNumbers.add(target.plateNumber);
    });
  });

  const plateCount = Math.max(...Array.from(plateNumbers));
  if (!Number.isFinite(plateCount) || plateCount < 3) {
    throw new Error("Notation must include at least 3 plates.");
  }

  const offsets = Array.from({ length: plateCount }, () => 0);
  const links = Array.from({ length: plateCount }, () => null);

  setupEntries.forEach(({ plateNumber, offset }) => {
    const index = plateCount - plateNumber;
    offsets[index] = offset;
  });

  linkEntries.forEach(({ plateNumber, targetsText }) => {
    const sourceIndex = plateCount - plateNumber;
    const sourceLink = links[sourceIndex] || createIdentityLink(plateCount, sourceIndex);
    targetsText
      .split(",")
      .map((target) => target.trim())
      .filter(Boolean)
      .forEach((targetToken) => {
        const target = parseLinkTarget(targetToken);
        if (!isParsedLinkTarget(target)) {
          throw new Error("Link targets must look like `P2` or `P2-`.");
        }

        const targetIndex = plateCount - target.plateNumber;
        sourceLink[targetIndex] = target.relation;
      });

    links[sourceIndex] = sourceLink;
  });

  return { plateCount, offsets, links };
}
