export function getVisiblePlateLabel(index, plateCount) {
  return `P${plateCount - index}`;
}

function formatOffset(offset) {
  return `${offset}`;
}

function formatLinkTarget(label, relation) {
  return relation === -1 ? `${label}-` : label;
}

export function buildNotationString(state) {
  const plateCount = state.plateCount || 0;
  if (!plateCount) {
    return "";
  }

  const setupParts = [];
  for (let index = plateCount - 1; index >= 0; index -= 1) {
    setupParts.push(`${getVisiblePlateLabel(index, plateCount)}=${formatOffset(state.offsets?.[index] ?? 0)}`);
  }

  const linkParts = [];
  for (let source = plateCount - 1; source >= 0; source -= 1) {
    const link = state.links?.[source];
    if (!link) {
      continue;
    }

    const targets = [];
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

    if (targets.length) {
      linkParts.push(`${getVisiblePlateLabel(source, plateCount)}>${targets.join(",")}`);
    }
  }

  return [
    setupParts.join(" "),
    "",
    linkParts.join(" "),
  ].join("\n");
}

function parseSetupToken(token) {
  const match = token.match(/^P(\d+)=(-?\d+)$/i);
  if (!match) {
    return null;
  }

  return {
    plateNumber: Number.parseInt(match[1], 10),
    offset: Number.parseInt(match[2], 10),
  };
}

function parseLinkToken(token) {
  const match = token.match(/^P(\d+)>(.+)$/i);
  if (!match) {
    return null;
  }

  return {
    plateNumber: Number.parseInt(match[1], 10),
    targetsText: match[2],
  };
}

function parseLinkTarget(token) {
  const match = token.match(/^P(\d+)([+-])?$/i);
  if (!match) {
    return null;
  }

  return {
    plateNumber: Number.parseInt(match[1], 10),
    relation: match[2] === "-" ? -1 : 1,
  };
}

export function parseNotationString(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (!lines.length) {
    throw new Error("Paste notation first.");
  }

  const setupTokens = lines[0].split(/\s+/).filter(Boolean);
  const setupEntries = setupTokens.map(parseSetupToken);
  if (setupEntries.some((entry) => !entry)) {
    throw new Error("The first line must use plate offsets like `P1=0`.");
  }

  const linkTokens = lines[1] ? lines[1].split(/\s+/).filter(Boolean) : [];
  const linkEntries = linkTokens.map(parseLinkToken);
  if (linkEntries.some((entry) => !entry)) {
    throw new Error("The second line must use links like `P1>P2,P3-`.");
  }

  const plateNumbers = new Set();
  setupEntries.forEach(({ plateNumber }) => plateNumbers.add(plateNumber));
  linkEntries.forEach(({ plateNumber, targetsText }) => {
    plateNumbers.add(plateNumber);
    targetsText.split(",").map((target) => target.trim()).filter(Boolean).forEach((targetToken) => {
      const target = parseLinkTarget(targetToken);
      if (!target) {
        throw new Error("Link targets must look like `P2` or `P2-`.");
      }
      plateNumbers.add(target.plateNumber);
    });
  });

  const plateCount = Math.max(...plateNumbers);
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
    const sourceLink = links[sourceIndex] || Array.from({ length: plateCount }, () => 0);
    targetsText.split(",").map((target) => target.trim()).filter(Boolean).forEach((targetToken) => {
      const target = parseLinkTarget(targetToken);
      if (!target) {
        throw new Error("Link targets must look like `P2` or `P2-`.");
      }

      const targetIndex = plateCount - target.plateNumber;
      sourceLink[targetIndex] = target.relation;
    });

    links[sourceIndex] = sourceLink;
  });

  return { plateCount, offsets, links };
}
