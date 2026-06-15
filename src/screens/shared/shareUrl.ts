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
