/** Narrative identities survive data releases and city substitutions. */
export function reelNarrativeAngle(key: string): string | null {
  if (key.includes("documentary-")) return null;
  if (/before-buy-v1$/.test(key) || key.includes("approvals-brisbane-perth"))
    return "permission-not-completion";
  if (key.includes("housing-balance")) return "supply-versus-new-need";
  if (key.includes("rents-brisbane-perth")) return "growth-versus-price";
  if (key.includes("rents-eight-capitals")) return "capital-spread";
  if (key.includes("sydney-rent-change")) return "change-in-growth-rate";
  if (key.includes("new-loan-rates")) return "loan-term-trade-off";
  if (key.includes("interstate-qld-wa")) return "net-movement";
  return null;
}

const NARRATIVE_COOLDOWN_DAYS = 7;
export function narrativeRecentlyPublished(
  key: string,
  history: { key: string; publishedAt: Date }[],
  now: Date
) {
  const angle = reelNarrativeAngle(key);
  if (!angle) return false;
  return history.some(
    (record) =>
      reelNarrativeAngle(record.key) === angle &&
      Number.isFinite(record.publishedAt.getTime()) &&
      now.getTime() - record.publishedAt.getTime() < NARRATIVE_COOLDOWN_DAYS * 86_400_000
  );
}
