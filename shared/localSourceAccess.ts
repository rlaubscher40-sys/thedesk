/** Only explicit publisher authentication/access denials pause collection.
 * Includes the legacy error persisted before download-stage diagnostics existed.
 * Do not broaden this to timeouts, 429, parsing errors or storage failures. */
export function localSourceAccessDenied(
  error: string | null | undefined,
): boolean {
  return /^(?:(?:Source discovery|Data download): )?Publisher HTTP (?:401|403)(?:$|[ ;(])/.test(
    error ?? "",
  );
}

export function pausedLocalSourceJobs(
  health: readonly { sourceKey: string; error: string | null }[],
): Set<string> {
  return new Set(
    health
      .filter((h) => localSourceAccessDenied(h.error))
      .map((h) => `local-data-${h.sourceKey}`),
  );
}
