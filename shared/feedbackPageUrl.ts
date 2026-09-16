/** Diagnostic location only. Never copy signed query links, fragments or URL
 * credentials into feedback records or transmit them automatically. */
export function feedbackPageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const location = url.origin + url.pathname;
    return location.length <= 512 ? location : null;
  } catch {
    return null;
  }
}
