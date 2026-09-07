import { describe, expect, it } from "vitest";
import { readSources, summariseSources, type SubscriberRow } from "./subscriberSources";

const NOW = new Date("2026-09-30T00:00:00Z");
const day = 86_400_000;

function sub(o: Partial<SubscriberRow> = {}): SubscriberRow {
  return {
    arrivalSource: "instagram",
    arrivalCampaign: null,
    confirmedAt: new Date(),
    unsubscribedAt: null,
    createdAt: new Date(NOW.getTime() - 30 * day),
    ...o,
  };
}

describe("summariseSources", () => {
  it("returns nothing to read from an empty list", () => {
    const s = summariseSources([]);
    expect(s.rows).toEqual([]);
    expect(s.unattributed).toBe(0);
    expect(s.since).toBeNull();
  });

  it("counts pre-attribution subscribers separately instead of guessing", () => {
    // Rows written before attribution shipped have a null arrival and always
    // will. Filing them as "direct" would make every channel look worse.
    const s = summariseSources([
      sub({ arrivalSource: null }),
      sub({ arrivalSource: null }),
      sub({ arrivalSource: "instagram" }),
    ]);
    expect(s.unattributed).toBe(2);
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0]!.total).toBe(1);
  });

  it("separates confirmed-and-active from everyone who filled the form", () => {
    const s = summariseSources([
      sub({ arrivalSource: "instagram" }),
      sub({ arrivalSource: "instagram", confirmedAt: null }),
      sub({ arrivalSource: "instagram", unsubscribedAt: new Date() }),
    ]);
    expect(s.rows[0]!.total).toBe(3);
    expect(s.rows[0]!.confirmed).toBe(1);
  });

  it("orders channels by volume, breaking ties alphabetically", () => {
    // Stable ordering matters: a table that reshuffles between renders when two
    // channels are level reads as data changing when nothing has.
    const s = summariseSources([
      sub({ arrivalSource: "google" }),
      sub({ arrivalSource: "instagram" }),
      sub({ arrivalSource: "instagram" }),
      sub({ arrivalSource: "linkedin" }),
    ]);
    expect(s.rows.map((r) => r.source)).toEqual(["instagram", "google", "linkedin"]);
  });

  it("dates the window from the earliest attributed subscriber", () => {
    const s = summariseSources([
      sub({ createdAt: new Date(NOW.getTime() - 5 * day) }),
      sub({ createdAt: new Date(NOW.getTime() - 40 * day) }),
      // An older unattributed row must not drag the start date back to a point
      // when nothing was being counted.
      sub({ arrivalSource: null, createdAt: new Date(NOW.getTime() - 400 * day) }),
    ]);
    expect(s.since).toEqual(new Date(NOW.getTime() - 40 * day));
  });
});

describe("readSources", () => {
  it("says attribution has not started rather than implying a channel failed", () => {
    const s = summariseSources([sub({ arrivalSource: null }), sub({ arrivalSource: null })]);
    const read = readSources(s, NOW);
    expect(read).toContain("predate attribution");
    expect(read).not.toContain("leads");
  });

  it("refuses to read the split in the first fortnight", () => {
    // "Instagram has produced nothing" and "we have not counted long enough"
    // look identical in the data and are completely different findings.
    const s = summariseSources([
      sub({ arrivalSource: "instagram", createdAt: new Date(NOW.getTime() - 3 * day) }),
      sub({ arrivalSource: "google", createdAt: new Date(NOW.getTime() - 2 * day) }),
    ]);
    const read = readSources(s, NOW);
    expect(read).toContain("Too early");
    expect(read).not.toContain("leads");
  });

  it("names the leading channel once the window is long enough", () => {
    const old = new Date(NOW.getTime() - 60 * day);
    const s = summariseSources([
      sub({ arrivalSource: "instagram", createdAt: old }),
      sub({ arrivalSource: "instagram", createdAt: old }),
      sub({ arrivalSource: "instagram", createdAt: old }),
      sub({ arrivalSource: "google", createdAt: old }),
    ]);
    const read = readSources(s, NOW);
    expect(read).toContain("led by instagram with 3");
    expect(read).toContain("75%");
  });

  it("handles a single subscriber without saying '1 days'", () => {
    const s = summariseSources([
      sub({ arrivalSource: "instagram", createdAt: new Date(NOW.getTime() - day) }),
    ]);
    expect(readSources(s, NOW)).toContain("1 attributed subscriber over 1 day.");
  });

  it("says there are no subscribers at all rather than nothing attributed", () => {
    expect(readSources(summariseSources([]), NOW)).toBe("No subscribers yet.");
  });
});
