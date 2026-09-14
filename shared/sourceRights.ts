/** Operational holds pending a documented permission/exception review. This
 * does not decide infringement or approve every source absent from this list.
 * Use original official releases as alternatives, not another mirror of the
 * same publisher's restricted work. */
const SOURCE_RIGHTS_HOLDS = [
  { host: "theguardian.com", reviewId: "guardian" },
  { host: "abc.net.au", reviewId: "abc" },
] as const;
export function sourceRightsHold(raw: string): string | null {
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/\.$/, "");
    const held = SOURCE_RIGHTS_HOLDS.find((r) => host === r.host || host.endsWith(`.${r.host}`));
    return held ? `source-rights-review:${held.reviewId}` : null;
  } catch {
    return "source-rights-review:invalid-url";
  }
}
