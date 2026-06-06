/**
 * Pick the line shown directly under a card's headline (the "dek").
 *
 * Coverage tabs use the publisher summary. AU/Property come from Google News,
 * whose "summary" just echoes the headline (so it's suppressed) — and not every
 * story gets every enrichment line. To guarantee a card is never blank under
 * the headline, fall back through whatever enrichment produced, in order of how
 * well it reads as a standalone subline. The caller hides whichever block the
 * dek was taken from so the same text never appears twice.
 */
import { shouldShowSummary } from "@shared/headline";

export type DekFrom = "summary" | "whyItMatters" | "counterpoint" | "sayThis";

type DekFields = {
  title: string;
  summary: string | null;
  whyItMatters: string | null;
  counterpoint: string | null;
  sayThis: string | null;
};

export function cardDek(item: DekFields): { text: string; from: DekFrom } | null {
  if (item.summary && shouldShowSummary(item.title, item.summary)) {
    return { text: item.summary, from: "summary" };
  }
  if (item.whyItMatters?.trim()) return { text: item.whyItMatters, from: "whyItMatters" };
  if (item.counterpoint?.trim()) return { text: item.counterpoint, from: "counterpoint" };
  if (item.sayThis?.trim()) return { text: item.sayThis, from: "sayThis" };
  return null;
}
