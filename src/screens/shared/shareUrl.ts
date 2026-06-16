export function buildShareUrl(
  baseUrl: string,
  notationText: string,
  { name, description }: { name?: string; description?: string } = {},
) {
  if (typeof window === "undefined") {
    return "";
  }

  const shareUrl = new URL(baseUrl || window.location.href);
  shareUrl.search = "";
  shareUrl.hash = "";

  if (notationText) {
    shareUrl.searchParams.set("notation", notationText);
  }

  if (name) {
    shareUrl.searchParams.set("name", name);
  }

  if (description) {
    shareUrl.searchParams.set("description", description);
  }

  return shareUrl.toString();
}

export function parseShareUrl(url: string) {
  const sharedUrl = new URL(url);
  return {
    notation: sharedUrl.searchParams.get("notation") || "",
    name: sharedUrl.searchParams.get("name") || "",
    description: sharedUrl.searchParams.get("description") || "",
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
    // Not a share URL. Fall through and treat the input as raw notation.
  }

  return { notation: text, name: "", description: "", isShareUrl: false };
}
