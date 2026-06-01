/**
 * Clusters same-story items reported by different outlets so a card can show
 * "5 outlets reporting" instead of treating a corroborated event the same as
 * a single-source rumour. Runs after URL dedup (which only catches the exact
 * same link) and before ranking, so the representative carries the count.
 *
 * Matching is deliberately conservative, headline token overlap with both a
 * Jaccard floor and a minimum shared-token count, so unrelated stories that
 * happen to share a common word (e.g. "Australia") are not merged. False
 * splits (two genuine duplicates left separate) are far cheaper than false
 * merges (two different stories collapsed into one).
 */
import type { FetchedItem } from "./rss";
import { titlesMatch, titleTokens } from "../../../shared/textSimilarity";

export { titleTokens };

export type Cluster = {
  /** The representative item for the story (the first one encountered). */
  item: FetchedItem;
  /** Number of distinct sources that ran this story. */
  corroborationCount: number;
  /** Distinct source names across the cluster. */
  corroboratingSources: string[];
};

/**
 * Greedy single-pass clustering. Returns one Cluster per distinct story, in
 * first-seen order, each carrying the representative item plus how many
 * distinct outlets covered it.
 */
export function clusterByTitle(
  items: FetchedItem[],
  opts: { minJaccard?: number; minShared?: number } = {}
): Cluster[] {
  // Conservative on purpose: a false merge shows the reader a wrong
  // corroboration count, while a false split just under-counts. Requiring
  // four shared significant tokens means we reliably catch near-verbatim
  // wire copy republished across outlets (the common duplicate) without
  // collapsing different finance stories that share two or three common
  // terms like "cash rate" or "first home buyer".
  const minJaccard = opts.minJaccard ?? 0.4;
  const minShared = opts.minShared ?? 4;

  const groups: { rep: FetchedItem; tokens: Set<string>; members: FetchedItem[] }[] = [];
  for (const item of items) {
    const tokens = titleTokens(item.title);
    let placed = false;
    for (const g of groups) {
      if (titlesMatch(tokens, g.tokens, minShared, minJaccard)) {
        g.members.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) groups.push({ rep: item, tokens, members: [item] });
  }

  return groups.map((g) => {
    const sources = Array.from(new Set(g.members.map((m) => m.source)));
    return {
      item: g.rep,
      corroborationCount: sources.length,
      corroboratingSources: sources,
    };
  });
}
