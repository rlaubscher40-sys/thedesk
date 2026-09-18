/**
 * Topic feeds and the machine-readable form of The Desk's own compilations.
 *
 * `/feed.xml` carries editions, which is the weekly product. A reader who wants
 * only the daily property reporting, or only the policy reporting, has had no
 * way to subscribe to it. These are the same published items the site already
 * shows, scoped to one category: no new content, no new store, no third-party
 * service, and nothing that is held from publication.
 *
 * What is NOT here, deliberately: any republication of a publisher's article
 * body. A feed item carries The Desk's own headline treatment and the excerpt
 * the archive already displays, and links to The Desk's story page, which is
 * where the original publisher is credited and linked.
 */

export type TopicFeed = {
  slug: string;
  /** The stored category on a feed item. */
  category: string;
  title: string;
  description: string;
};

export const TOPIC_FEEDS: TopicFeed[] = [
  {
    slug: "property",
    category: "PROPERTY",
    title: "Australian property",
    description:
      "The Desk's daily reporting on Australian housing: supply, rents, prices, lending and the records behind them.",
  },
  {
    slug: "policy",
    category: "POLICY",
    title: "Housing policy",
    description:
      "Planning, tax and government decisions as The Desk reports them, with the distinction between an announcement and a delivered home kept intact.",
  },
  {
    slug: "markets",
    category: "MARKETS",
    title: "Markets",
    description:
      "The traded markets and rates that sit behind Australian housing finance, as The Desk reports them.",
  },
  {
    slug: "economy",
    category: "MACRO",
    title: "The economy around housing",
    description:
      "Population, jobs, inflation and the wider economy: context for Australian housing, not a measure of it.",
  },
];

export function topicFeed(slug: string): TopicFeed | undefined {
  return TOPIC_FEEDS.find((feed) => feed.slug === slug);
}

/**
 * Reuse conditions for The Desk's own compilations. Deliberately narrow: this
 * covers what The Desk made, and says so, because most of what a housing
 * publisher handles belongs to somebody else.
 */
export const RESEARCH_REUSE_TERMS =
  "This file is The Desk's own compilation. You may reuse it, including commercially, with attribution to The Desk and a link to thedesk.au. The underlying releases, figures and wording belong to the publishers named in the source column, and their own terms govern those; check the source link before relying on or redistributing any of them. The Desk makes no warranty of fitness and does not licence anything it does not own.";

export type ResearchCsvColumn = { key: string; header: string };

/** Fixed column order, so a saved file stays readable against an older copy. */
export const RELEASE_CALENDAR_CSV_COLUMNS: ResearchCsvColumn[] = [
  { key: "id", header: "id" },
  { key: "publisher", header: "publisher" },
  { key: "title", header: "release" },
  { key: "measures", header: "what_it_measures" },
  { key: "geography", header: "geography" },
  { key: "unit", header: "unit" },
  { key: "observation_period", header: "observation_period" },
  { key: "cadence", header: "cadence" },
  { key: "date_status", header: "date_status" },
  { key: "scheduled_sydney", header: "scheduled_sydney" },
  { key: "confirmed_from", header: "confirmed_from" },
  { key: "last_checked_on", header: "last_checked_on" },
  { key: "source_url", header: "source_url" },
  { key: "source_calendar_url", header: "source_calendar_url" },
  { key: "reuse", header: "reuse" },
];

/**
 * RFC 4180 quoting. Every field is quoted, so a comma, a quote, a newline or a
 * leading character a spreadsheet would treat as a formula cannot change the
 * shape of the file.
 */
export function csvField(value: string | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  // A leading =, +, - or @ is a formula in Excel and Sheets. Prefix it so the
  // cell shows the text rather than executing it.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function csvRow(values: (string | null | undefined)[]): string {
  return values.map(csvField).join(",");
}
