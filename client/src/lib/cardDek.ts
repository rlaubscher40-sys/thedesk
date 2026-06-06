/**
 * Pick the line shown directly under a card's headline (the "dek").
 *
 * Coverage tabs use the publisher summary. AU/Property come from Google News,
 * whose "summary" just echoes the headline (so it's suppressed) — and not
 * every story gets every enrichment line. To avoid a blank card, fall back
 * through whatever enrichment produced, in order of how well it reads as a
 * standalone subline. The caller hides whichever block the dek was taken
 * from so the same text never appears twice.
 *
 * Note: sayThis is intentionally NOT in the fallback chain. It is the
 * card's editorial moment and earns its own labelled, panel-decorated
 * block (SayThisLine). Silently demoting it to plain dek text — which is
 * what happened on stories with no summary / whyItMatters / counterpoint —
 * suppressed the labelled block on the next-render and made the most
 * important per-card line invisible to the reader. Better to leave the
 * dek empty than to swallow the Say This.
 */
import { shouldShowSummary } from "@shared/headline";

export type DekFrom = "summary" | "whyItMatters" | "counterpoint";

type DekFields = {
  title: string;
  summary: string | null;
  whyItMatters: string | null;
  counterpoint: string | null;
};

export function cardDek(item: DekFields): { text: string; from: DekFrom } | null {
  if (item.summary && shouldShowSummary(item.title, item.summary)) {
    return { text: item.summary, from: "summary" };
  }
  if (item.whyItMatters?.trim()) return { text: item.whyItMatters, from: "whyItMatters" };
  if (item.counterpoint?.trim()) return { text: item.counterpoint, from: "counterpoint" };
  return null;
}
