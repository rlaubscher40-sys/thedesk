import { describe, expect, it } from "vitest";
import type { DailyFeedItem, Edition } from "../db/schema";
import {
  sourceAttributedEdition,
  sourceUrlIdentity,
  storyPublicationKeys,
} from "./socialProvenance";
const row = {
  id: 1,
  title: "Sydney rents rose 3.5% in July 2026",
  summary: "Annual change in rents paid, not rent levels.",
  source: "ABS",
  sourceUrl: "https://www.abs.gov.au/releases/rents?utm_source=ig",
  feedDate: "2026-09-08",
  category: "PROPERTY",
  channel: "PROPERTY",
  priority: 50,
} as DailyFeedItem;
const edition = {
  weekOf: "2026-09-07",
  topics: [
    {
      title: "Perth rents fell 3.5%",
      summary: "Unsupported cause",
      category: "PROPERTY",
      sourceItemIds: [1],
      socialSource: {
        publisher: "FAKE",
        url: "https://fake.example",
        feedItemId: 1,
        feedDate: "2026-09-08",
      },
    },
  ],
} as Edition;
describe("source-attributed weekly social copy", () => {
  it("rehydrates source IDs and replaces unverified social claims with the actual source headline", async () => {
    const out = await sourceAttributedEdition(edition, async () => [row]);
    expect(out.topics[0]).toMatchObject({
      title: row.title,
      summary: row.summary,
      socialSource: {
        publisher: "ABS",
        feedDate: row.feedDate,
        url: row.sourceUrl,
      },
    });
    expect(JSON.stringify(out)).not.toMatch(/FAKE|Perth|Unsupported/);
  });
  it.each(["missing", "stale", "future", "invalid-url", "unrelated", "legacy", "invalid-week"])(
    "holds %s sources rather than guessing attribution",
    async (kind) => {
      const source = { ...row };
      const input = structuredClone(edition);
      if (kind === "stale") source.feedDate = "2026-09-06";
      if (kind === "future") source.feedDate = "2026-09-14";
      if (kind === "invalid-url") source.sourceUrl = "javascript:alert(1)";
      if (kind === "unrelated") {
        source.title = "Chipmaker profits increase";
        source.summary = "Shares rally.";
      }
      if (kind === "legacy") input.topics[0]!.sourceItemIds = undefined;
      if (kind === "invalid-week") input.weekOf = "2026-02-31";
      expect(
        (
          await sourceAttributedEdition(input, async () =>
            kind === "missing" || kind === "legacy" ? [] : [source]
          )
        ).topics
      ).toEqual([]);
    }
  );
  it("deduplicates references to the same underlying news within an edition", async () => {
    expect(
      (
        await sourceAttributedEdition(
          { ...edition, topics: [...edition.topics, ...edition.topics] },
          async () => [row]
        )
      ).topics
    ).toHaveLength(1);
  });
  it("ignores tracking and title punctuation but retains content-selecting URLs and numbers", () => {
    expect(storyPublicationKeys(row)).toEqual(
      storyPublicationKeys({
        ...row,
        sourceUrl: "http://abs.gov.au/releases/rents/#top",
        title: "SYDNEY rents rose 3.5% in July 2026!",
      })
    );
    expect(sourceUrlIdentity("https://example.com/article?id=2&utm_source=a")).toContain("id=2");
    expect(
      storyPublicationKeys({ ...row, title: "Sydney rents rose 4.5% in July 2026" })[1]
    ).not.toBe(storyPublicationKeys(row)[1]);
    expect(storyPublicationKeys({ ...row, sourceUrl: null })).toEqual([]);
  });
});
