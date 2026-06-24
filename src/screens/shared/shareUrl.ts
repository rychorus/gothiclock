import { decodeCompactLock, encodeCompactLock } from "../../lib/compactNotation";
import { buildNotationString } from "../../lib/notation";
import type { Offsets, PlateLinks } from "../../lib/types";

type CompactShareState = {
  plateCount: number;
  offsets: Offsets;
  links: PlateLinks;
};

export function buildShareUrl(
  baseUrl: string,
  notationText: string,
  { name, description, compactState }: { name?: string; description?: string; compactState?: CompactShareState } = {},
) {
  if (typeof window === "undefined") {
    return "";
  }

  const shareUrl = new URL(baseUrl || window.location.href);
  shareUrl.search = "";
  shareUrl.hash = "";

  const compactToken = compactState ? encodeCompactLock(compactState) : "";
  if (compactToken) {
    const hashParams = new URLSearchParams();
    if (name) {
      hashParams.set("name", name);
    }
    if (description) {
      hashParams.set("description", description);
    }
    const hashParamsText = hashParams.toString();
    shareUrl.hash = hashParamsText ? `${compactToken}?${hashParamsText}` : compactToken;
  } else if (notationText) {
    shareUrl.searchParams.set("notation", notationText);
    if (name) {
      shareUrl.searchParams.set("name", name);
    }
    if (description) {
      shareUrl.searchParams.set("description", description);
    }
  }

  return shareUrl.toString();
}

export function parseShareUrl(url: string) {
  const sharedUrl = new URL(url);
  const hashText = sharedUrl.hash.replace(/^#/, "").trim();
  const [compactToken, hashQuery = ""] = hashText.split("?", 2);
  const hashParams = new URLSearchParams(hashQuery);
  const compactLock = compactToken ? decodeCompactLock(compactToken) : null;

  return {
    notation: sharedUrl.searchParams.get("notation") || (compactLock ? buildNotationString(compactLock) : ""),
    name: sharedUrl.searchParams.get("name") || hashParams.get("name") || "",
    description: sharedUrl.searchParams.get("description") || hashParams.get("description") || "",
  };
}

function stripTrailingUrlPunctuation(url: string) {
  return url.replace(/[),.;:!?]+$/g, "");
}

export function extractImportedShareUrls(input: string) {
  const urlMatches = String(input || "")
    .match(/https?:\/\/[^\s<>"'`]+/gi) || [];

  return [...new Set(urlMatches.map(stripTrailingUrlPunctuation))]
    .map((url) => {
      try {
        const parsed = parseShareUrl(url);
        if (!parsed.notation) {
          return null;
        }

        return {
          url,
          ...parsed,
        };
      } catch {
        return null;
      }
    })
    .filter((entry): entry is { url: string; notation: string; name: string; description: string } => Boolean(entry));
}

export function parseImportedNotationInput(input: string) {
  const text = String(input || "").trim();
  if (!text) {
    return { notation: "", name: "", description: "", isShareUrl: false };
  }

  const importedShareUrls = extractImportedShareUrls(text);
  if (importedShareUrls.length > 0) {
    const firstShareUrl = importedShareUrls[0];
    return {
      ...firstShareUrl,
      isShareUrl: true,
    };
  }

  try {
    const parsed = parseShareUrl(text);
    if (parsed.notation) {
      return {
        ...parsed,
        isShareUrl: true,
      };
    }
  } catch {
    const compactLock = decodeCompactLock(text);
    if (compactLock) {
      return {
        notation: buildNotationString(compactLock),
        name: "",
        description: "",
        isShareUrl: true,
      };
    }

    // Not a share URL. Fall through and treat the input as raw notation.
  }

  return { notation: text, name: "", description: "", isShareUrl: false };
}
