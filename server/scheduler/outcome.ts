/** Store only the bounded publication outcome, not arbitrary response payloads. */
export function describeScheduledOutcome(key: string, raw: unknown): string {
  if (!key.startsWith("instagram-")) return "Task completed";
  if (!raw || typeof raw !== "object")
    return "Task completed; publication not confirmed by response";
  const data = raw as Record<string, unknown>;
  if (data.skipped === true)
    return `Intentionally skipped: ${typeof data.reason === "string" ? data.reason.replace(/\s+/g, " ").slice(0, 350) : "No eligible publication"}`;
  if (typeof data.postId === "string" && /^\d+$/.test(data.postId))
    return `Confirmed publication: ${data.postId}`;
  return key.includes("insights")
    ? "Measurement collection completed; inspect completeness counts"
    : "Task completed; publication not confirmed by response";
}
