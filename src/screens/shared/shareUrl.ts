export function buildShareUrl(baseUrl, notationText) {
  if (typeof window === "undefined") {
    return "";
  }

  const shareUrl = new URL(baseUrl || window.location.href);
  shareUrl.search = "";
  shareUrl.hash = "";

  if (notationText) {
    shareUrl.searchParams.set("notation", notationText);
  }

  return shareUrl.toString();
}
