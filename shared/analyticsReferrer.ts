/** Accept a web URL or a hostname already reduced by the client. Fail closed. */
export function analyticsReferrer(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const value = /^https?:\/\//i.test(raw)
      ? new URL(raw)
      : /^[a-z0-9.-]+(?::\d+)?$/i.test(raw)
        ? new URL(`https://${raw}`)
        : null;
    return value?.hostname.slice(0, 256) || null;
  } catch {
    return null;
  }
}
