import { sydneySocialClock } from "../../../shared/instagramSchedule";
import type { FetchedItem } from "./rss";

/** A reading-order hint only, never publication evidence or an exclusion.
 * ABC topic indexes mix current reporting with months-old high-impact titles.
 * Keep those older paths available in the reserve, after potentially fresh news.
 */
export function olderIndexPath(item: FetchedItem, now: Date): boolean {
  if (item.discovery !== "publisher-index" || item.isoDate || !item.url) return false;
  try {
    const url = new URL(item.url);
    if (url.hostname !== "www.abc.net.au" && url.hostname !== "abc.net.au") return false;
    const day = /^\/news\/(20\d{2}-\d{2}-\d{2})\/[^/]+\/\d+$/.exec(url.pathname)?.[1];
    if (!day) return false;
    const date = Date.parse(`${day}T00:00:00Z`);
    if (!Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== day) return false;
    const today = Date.parse(`${sydneySocialClock(now).dateISO}T00:00:00Z`);
    return today - date > 4 * 86400_000;
  } catch {
    return false;
  }
}
