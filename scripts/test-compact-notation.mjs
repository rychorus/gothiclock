import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const { build } = await import("esbuild");

async function loadModule(entryPoint) {
  const result = await build({
    entryPoints: [resolve(process.cwd(), entryPoint)],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  });

  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

function extractFixtures(text) {
  const fixtures = [];
  const urlMatches = text.match(/https?:\/\/[^\s]+/g) || [];

  for (const url of urlMatches) {
    try {
      const parsed = new URL(url);
      fixtures.push({
        name: parsed.searchParams.get("name") || `Fixture ${fixtures.length + 1}`,
        url,
      });
    } catch {
      // Ignore malformed URLs in the fixture file.
    }
  }

  return fixtures;
}

function normalizeText(text) {
  return text.trim().replace(/\s+/g, " ");
}

const notation = await loadModule("src/lib/notation.ts");
const shareUrl = await loadModule("src/screens/shared/shareUrl.ts");
const compactNotation = await loadModule("src/lib/compactNotation.ts");

globalThis.window = {
  location: {
    href: "https://rychorus.github.io/gothiclock/",
  },
};

async function main() {
  const inputPath = resolve(process.cwd(), "test-data", "gothic-locks-rychorus.txt");
  const text = await readFile(inputPath, "utf8");
  const fixtures = extractFixtures(text);

  const failures = [];
  let tokenOnlyAccepted = 0;
  let compactRoundTrips = 0;

  for (const fixture of fixtures) {
    try {
      const parsedShare = shareUrl.parseShareUrl(fixture.url);
      const parsedNotation = notation.parseNotationString(parsedShare.notation);
      const canonicalNotation = notation.buildNotationString(parsedNotation);

      if (normalizeText(parsedShare.notation) !== normalizeText(canonicalNotation)) {
        throw new Error("legacy notation did not normalize cleanly");
      }

      const compactUrl = shareUrl.buildShareUrl(
        fixture.url,
        parsedShare.notation,
        {
          name: parsedShare.name,
          description: parsedShare.description,
          compactState: {
            plateCount: parsedNotation.plateCount,
            offsets: parsedNotation.offsets,
            links: parsedNotation.links,
          },
        },
      );

      const compactParsed = shareUrl.parseShareUrl(compactUrl);
      if (normalizeText(compactParsed.notation) !== normalizeText(canonicalNotation)) {
        throw new Error("compact URL did not decode back to the same notation");
      }

      const compactHash = new URL(compactUrl).hash.replace(/^#/, "");
      const compactToken = compactHash.split("?", 1)[0];
      if (!compactToken) {
        throw new Error("compact URL did not include a token fragment");
      }

      if (compactHash.includes("?")) {
        const metaIndex = compactHash.indexOf("?");
        if (metaIndex <= 0) {
          throw new Error("token did not appear before metadata");
        }
      }

      const tokenOnly = shareUrl.parseImportedNotationInput(compactToken);
      if (!tokenOnly.isShareUrl || normalizeText(tokenOnly.notation) !== normalizeText(canonicalNotation)) {
        throw new Error("bare token did not import as notation");
      }

      const roundTripToken = compactNotation.encodeCompactLock({
        plateCount: parsedNotation.plateCount,
        offsets: parsedNotation.offsets,
        links: parsedNotation.links,
      });
      const decodedRoundTrip = compactNotation.decodeCompactLock(roundTripToken);
      if (!decodedRoundTrip) {
        throw new Error("compact token did not decode");
      }

      if (normalizeText(notation.buildNotationString(decodedRoundTrip)) !== normalizeText(canonicalNotation)) {
        throw new Error("decoded compact token did not match canonical notation");
      }

      tokenOnlyAccepted += 1;
      compactRoundTrips += 1;
      console.log(`PASS  ${fixture.name}`);
    } catch (error) {
      failures.push(`${fixture.name}: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`FAIL  ${fixture.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`\n${fixtures.length - failures.length}/${fixtures.length} fixtures passed.`);
  console.log(`${compactRoundTrips} compact round-trips verified.`);
  console.log(`${tokenOnlyAccepted} bare tokens accepted.`);

  process.exitCode = failures.length ? 1 : 0;
}

await main();
