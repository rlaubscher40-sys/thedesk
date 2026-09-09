import { describe, expect, it } from "vitest";
import { normaliseEvidence } from "./normalize";
import { evidenceRegions, sourceHealth, PROPERTY_REGIONS } from "../../shared/propertyCoverage";
import { STATE_PROPERTY_SOURCES, EVIDENCE_SOURCES } from "../../scripts/ingest/propertySources";
import type { FetchedItem } from "../../scripts/ingest/lib/rss";

const now = new Date("2026-09-08T12:00:00Z");
const item: FetchedItem = {
  title: "Launceston rental vacancies fall",
  summary: "Tasmania rental housing supply remains tight.",
  source: "Fixture",
  url: "https://example.org/housing?utm_source=news&id=123",
  category: "PROPERTY",
  channel: "PROPERTY",
  imageUrl: null,
  isoDate: "2026-09-07T10:00:00Z",
};

describe("nationwide evidence", () => {
  it("does not archive search spam or Canadian Perth as Australian property evidence", () => {
    for (const title of [
      "Perth Housing Market Update | April 2026 Emergency Alert Today (7Y9mHxXuGJ)",
      "Perth housing market update April 2026",
    ])
      expect(normaliseEvidence({ ...item, title }, now)).toBeNull();
    expect(
      normaliseEvidence(
        {
          ...item,
          title: "Major housing project approved on historic Perth golf course",
          source: "CBC",
          url: "https://news.google.com/rss/articles/fixture",
        },
        now
      )
    ).toBeNull();
  });
  it("has independent statewide, regional and government feeds for all eight jurisdictions", () => {
    for (const region of PROPERTY_REGIONS) {
      const sources = STATE_PROPERTY_SOURCES.filter((source) => source.region === region.code);
      expect(sources.map((source) => source.beat)).toEqual(["housing", "regional", "policy"]);
      expect(new URL(sources[1]!.url).searchParams.get("q")).toContain(region.name);
      expect(new URL(sources[2]!.url).searchParams.get("q")).toContain(`site:${region.domain}`);
    }
    expect(new Set(EVIDENCE_SOURCES.map((source) => source.id)).size).toBe(EVIDENCE_SOURCES.length);
  });
  it("retains real publication dates and deduplicates tracking variants", () => {
    const row = normaliseEvidence(item, now)!;
    expect(row.publishedAt.toISOString()).toBe(new Date(item.isoDate!).toISOString());
    expect(row.regions).toEqual(["TAS"]);
    expect(row.sourceUrl).toBe("https://example.org/housing?id=123");
    expect(
      normaliseEvidence({ ...item, url: "https://example.org/housing?id=123&utm_campaign=x" }, now)
        ?.identity
    ).toBe(row.identity);
    expect(
      normaliseEvidence({ ...item, url: "https://example.org/housing?id=124" }, now)?.identity
    ).not.toBe(row.identity);
  });
  it("rejects unknown/future/old dates, unsafe URLs and unrelated reporting", () => {
    for (const isoDate of [null, "garbage", "2026-09-09T00:00:00Z", "2025-01-01"])
      expect(normaliseEvidence({ ...item, isoDate }, now)).toBeNull();
    for (const url of ["javascript:alert(1)", "https://user:password@example.org/x", null])
      expect(normaliseEvidence({ ...item, url }, now)).toBeNull();
    expect(
      normaliseEvidence({ ...item, title: "Football team wins", summary: "Sport scores" }, now)
    ).toBeNull();
  });
  it("accepts a dated, relevant headline when a publisher supplies no summary", () => {
    expect(normaliseEvidence({ ...item, summary: "" }, now)?.title).toBe(item.title);
  });
  it("does not pretend a query target proves article geography", () => {
    expect(evidenceRegions("Housing rents increased nationally. We must act now.")).toEqual([]);
    expect(evidenceRegions("Perth and Adelaide housing values")).toEqual(["WA", "SA"]);
    expect(evidenceRegions("NSW and Queensland housing")).toEqual(["NSW", "QLD"]);
  });
  it("distinguishes feed failure, quiet feeds, stale collection and old evidence", () => {
    const status = {
      checkedAt: now,
      lastSuccessAt: now,
      error: null,
      accepted: 3,
      newestPublishedAt: new Date("2026-09-07"),
    };
    expect(sourceHealth(undefined, now)).toBe("not checked");
    expect(sourceHealth(status, now)).toBe("collecting");
    expect(sourceHealth({ ...status, error: "failed" }, now)).toBe("failed");
    expect(sourceHealth({ ...status, accepted: 0 }, now)).toBe("no usable evidence");
    expect(sourceHealth({ ...status, checkedAt: new Date("2026-09-07") }, now)).toBe("overdue");
    expect(sourceHealth({ ...status, newestPublishedAt: new Date("2026-08-01") }, now)).toBe(
      "older evidence"
    );
  });
});
