import { describe, it, expect } from "vitest";
import { clusterByTitle, titleTokens, type Cluster } from "./cluster";
import type { FetchedItem } from "./rss";

function item(source: string, title: string): FetchedItem {
  return { source, category: "MARKETS", title, summary: title, url: `https://x/${source}/${title}`, isoDate: null };
}

function byTitle(clusters: Cluster[], title: string): Cluster | undefined {
  return clusters.find((c) => c.item.title === title);
}

describe("titleTokens", () => {
  it("drops stopwords, short words and punctuation", () => {
    const t = titleTokens("The RBA holds the cash rate at 4.35%");
    expect(t.has("rba")).toBe(true);
    expect(t.has("holds")).toBe(true);
    expect(t.has("cash")).toBe(true);
    expect(t.has("rate")).toBe(true);
    expect(t.has("the")).toBe(false); // stopword
    expect(t.has("at")).toBe(false); // too short
  });
});

describe("clusterByTitle", () => {
  it("merges near-verbatim coverage from different outlets and counts sources", () => {
    // Wire copy (e.g. AAP) republished across outlets is the common
    // duplicate, near-identical headlines, which is what we reliably merge.
    const items = [
      item("ABC", "RBA holds cash rate at 4.35 percent for third straight meeting"),
      item("Guardian", "RBA holds cash rate at 4.35 percent at third meeting"),
      item("AFR", "RBA holds cash rate at 4.35 percent, third meeting on hold"),
    ];
    const clusters = clusterByTitle(items);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.corroborationCount).toBe(3);
    expect(clusters[0]!.corroboratingSources).toEqual(["ABC", "Guardian", "AFR"]);
  });

  it("is conservative: a heavy paraphrase that shares only a few tokens stays separate", () => {
    // "Reserve Bank" vs "RBA" plus reworded filler shares too little to
    // merge. Under-counting corroboration is the cost we accept to avoid
    // ever showing a wrong count.
    const items = [
      item("ABC", "RBA holds cash rate at 4.35 percent for third meeting"),
      item("Guardian", "Reserve Bank keeps borrowing costs steady once again"),
    ];
    expect(clusterByTitle(items)).toHaveLength(2);
  });

  it("keeps unrelated stories separate even when they share a common word", () => {
    const items = [
      item("ABC", "Sydney auction clearance rate climbs above 70 percent"),
      item("Guardian", "Federal budget deficit widens to 28 billion dollars"),
    ];
    const clusters = clusterByTitle(items);
    expect(clusters).toHaveLength(2);
    expect(clusters.every((c) => c.corroborationCount === 1)).toBe(true);
  });

  it("does not merge on a single shared significant token", () => {
    const items = [
      item("ABC", "Mortgage lending rules tighten for investors"),
      item("Guardian", "Mortgage stress hits regional renters hardest"),
    ];
    // Only "mortgage" is shared, below the minShared floor.
    expect(clusterByTitle(items)).toHaveLength(2);
  });

  it("dedupes source names within a cluster", () => {
    const items = [
      item("ABC", "RBA holds cash rate at 4.35 percent third meeting"),
      item("ABC", "RBA holds cash rate at 4.35 percent third meeting in row"),
    ];
    const clusters = clusterByTitle(items);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.corroborationCount).toBe(1); // same outlet, not corroboration
  });

  it("preserves the first-seen item as the representative", () => {
    const items = [
      item("ABC", "RBA holds cash rate at 4.35 percent for the third meeting"),
      item("AFR", "Reserve Bank holds cash rate at 4.35 percent third meeting"),
    ];
    const clusters = clusterByTitle(items);
    expect(clusters[0]!.item.source).toBe("ABC");
    expect(byTitle(clusters, items[0]!.title)).toBeDefined();
  });
});
