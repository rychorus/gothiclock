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

export function parseImportedNotationInput(input: string) {
  const text = String(input || "").trim();
  if (!text) {
    return { notation: "", name: "", description: "" };
  }

  try {
    const parsed = parseShareUrl(text);
    if (parsed.notation) {
      return parsed;
    }
  } catch {
    // Not a share URL. Fall through and treat the input as raw notation.
  }

  return { notation: text, name: "", description: "" };
}
