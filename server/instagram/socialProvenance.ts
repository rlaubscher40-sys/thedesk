import { createHash } from "node:crypto";
import type { DailyFeedItem, Edition } from "../db/schema";
import { getFeedItemsByIds } from "../db/feed";
import { pickPropertyStories } from "./propertyEditorial";
import { sourceGroundedTopic } from "./sourceContent";
import { sydneySocialClock } from "../../shared/instagramSchedule";

/** URL identity ignores tracking, but preserves content-selecting query parameters. */
export function sourceUrlIdentity(value: string | null | undefined): string | null {
  try {
    if (!value || value.length > 2048) return null;
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
    if (!url.hostname.includes(".") || /^(localhost|127\.|10\.|192\.168\.)/.test(url.hostname))
      return null;
    url.hash = "";
    url.protocol = "https:";
    url.hostname = url.hostname.replace(/^www\./, "");
    for (const key of [...url.searchParams.keys()])
      if (/^(utm_|fbclid$|gclid$|dclid$|mc_cid$|mc_eid$)/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/$/, "") || "/";
    return url.toString();
  } catch {
    return null;
  }
}
const digest = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 56);
export function storyPublicationKeys(story: Pick<DailyFeedItem, "title" | "sourceUrl">): string[] {
  const url = sourceUrlIdentity(story.sourceUrl);
  const title = story.title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  if (!url || !title) return [];
  // URL survives retitling/re-ingestion. Headline survives syndication/new URL.
  return [`ig-news-${digest("url:" + url)}`, `ig-news-${digest("title:" + title)}`];
}

/** Rehydrate references; never trust model-provided socialSource or synthesis claims. */
export async function sourceAttributedEdition(
  edition: Edition,
  read = getFeedItemsByIds,
  now = new Date()
): Promise<Edition> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(edition.weekOf)) return { ...edition, topics: [] };
  const start = new Date(`${edition.weekOf}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== edition.weekOf)
    return { ...edition, topics: [] };
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const ids = [...new Set(edition.topics.flatMap((topic) => topic.sourceItemIds ?? []))]
    .filter(Number.isSafeInteger)
    .filter((id) => id > 0)
    .slice(0, 35);
  const rows = await read(ids);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const used = new Set<string>();
  const topics = edition.topics.flatMap((topic) => {
    // One source-led social story per synthesis topic. The full analysis stays
    // in the edition; its bibliography is not a proof of every generated claim.
    const source = (topic.sourceItemIds ?? [])
      .map((id) => byId.get(id))
      .find(
        (row) =>
          row &&
          /^\d{4}-\d{2}-\d{2}$/.test(row.feedDate) &&
          row.feedDate >= edition.weekOf &&
          row.feedDate <= sydneySocialClock(now).dateISO &&
          row.feedDate <= end.toISOString().slice(0, 10) &&
          row.source?.trim() &&
          sourceUrlIdentity(row.sourceUrl) &&
          pickPropertyStories([row], 1).length
      );
    if (!source) return [];
    const keys = storyPublicationKeys(source);
    if (keys.some((key) => used.has(key))) return [];
    keys.forEach((key) => used.add(key));
    return [
      sourceGroundedTopic({
        title: source.title,
        summary: source.summary ?? "",
        category: source.category,
        sourceItemIds: [source.id],
        socialSource: {
          feedItemId: source.id,
          publisher: source.source,
          url: source.sourceUrl!,
          feedDate: source.feedDate,
        },
      }),
    ];
  });
  return { ...edition, rubensTake: null, topics };
}
