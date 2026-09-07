import { describe, expect, it } from "vitest";
import {
  MIN_POSTS_FOR_SIGNAL,
  readFormats,
  summariseFormats,
  type InsightRow,
} from "./instagramInsights";

function row(o: Partial<InsightRow> = {}): InsightRow {
  return {
    postType: "daily",
    likes: 10,
    comments: 2,
    reach: 1000,
    saved: 20,
    shares: 5,
    metricsFetchedAt: new Date(),
    ...o,
  };
}

/** n posts of one type, each with the given saves against 1,000 reach. */
function saves(postType: string, values: number[]): InsightRow[] {
  return values.map((saved) => row({ postType, saved }));
}

function find(rows: InsightRow[], postType: string) {
  return summariseFormats(rows).find((s) => s.postType === postType)!;
}

describe("summariseFormats", () => {
  it("returns a row for every format, including ones that have never posted", () => {
    // "The Number published nothing" is an answer, not an absence. Dropping the
    // row would make a broken job look like a format that isn't configured.
    const summaries = summariseFormats([]);
    expect(summaries.map((s) => s.postType)).toEqual([
      "daily",
      "stat",
      "reel",
      "weekly",
      "monthly",
      "coverage",
    ]);
    for (const s of summaries) {
      expect(s.measured).toBe(0);
      expect(s.savesPer1k).toBeNull();
      expect(s.conclusive).toBe(false);
    }
  });

  it("normalises saves against reach rather than counting them raw", () => {
    // Same save count, very different reach: the smaller post landed harder.
    const wide = find([row({ postType: "daily", reach: 10_000, saved: 100 })], "daily");
    const tight = find([row({ postType: "daily", reach: 1_000, saved: 100 })], "daily");
    expect(wide.savesPer1k).toBe(10);
    expect(tight.savesPer1k).toBe(100);
  });

  it("uses the median so one unusual post cannot define a format", () => {
    // Four ordinary posts and one that went wide. A mean would be dragged to
    // ~44; the median stays where the typical post actually sits.
    const s = find(saves("daily", [20, 20, 20, 20, 200]), "daily");
    expect(s.savesPer1k).toBe(20);
  });

  it("excludes posts whose metrics have not landed yet, and says how many", () => {
    // A format must never look weak because the insights job has not run.
    const rows = [
      ...saves("stat", [30, 30]),
      row({ postType: "stat", reach: null, saved: null, metricsFetchedAt: null }),
    ];
    const s = find(rows, "stat");
    expect(s.measured).toBe(2);
    expect(s.awaiting).toBe(1);
    expect(s.savesPer1k).toBe(30);
  });

  it("treats zero reach as unmeasured rather than dividing by it", () => {
    const s = find([row({ postType: "daily", reach: 0, saved: 5 })], "daily");
    expect(s.measured).toBe(0);
    expect(s.awaiting).toBe(1);
    expect(s.savesPer1k).toBeNull();
  });

  it("distinguishes a metric that was never fetched from a genuine zero", () => {
    // A missing saves figure must not be averaged in as "nobody saved it".
    const missing = find([row({ postType: "daily", saved: null })], "daily");
    expect(missing.savesPer1k).toBeNull();

    const genuine = find([row({ postType: "daily", saved: 0 })], "daily");
    expect(genuine.savesPer1k).toBe(0);
  });

  it("still reports reach for a post whose saves were never fetched", () => {
    const s = find([row({ postType: "daily", reach: 2000, saved: null })], "daily");
    expect(s.medianReach).toBe(2000);
    expect(s.measured).toBe(1);
  });

  it("only calls a format conclusive once enough posts back it", () => {
    const thin = find(saves("daily", Array(MIN_POSTS_FOR_SIGNAL - 1).fill(20)), "daily");
    expect(thin.conclusive).toBe(false);

    const enough = find(saves("daily", Array(MIN_POSTS_FOR_SIGNAL).fill(20)), "daily");
    expect(enough.conclusive).toBe(true);
  });

  it("keeps each format's posts out of the others' figures", () => {
    const rows = [...saves("daily", [10, 10]), ...saves("stat", [90, 90])];
    expect(find(rows, "daily").savesPer1k).toBe(10);
    expect(find(rows, "stat").savesPer1k).toBe(90);
  });
});

describe("readFormats", () => {
  it("says the data is not there yet when nothing has been measured", () => {
    expect(readFormats(summariseFormats([]))).toContain("No posts have engagement data yet");
  });

  it("refuses to compare formats that lack the posts to be compared", () => {
    const rows = [...saves("daily", [10, 90]), ...saves("stat", [90, 10])];
    expect(readFormats(summariseFormats(rows))).toContain("Not enough posts yet");
  });

  it("does not call a winner when two formats are running level", () => {
    // A gap this size on a sample this small is noise, and reporting it as a
    // finding is how a measurement tool becomes worse than the guesswork.
    const rows = [
      ...saves("daily", Array(MIN_POSTS_FOR_SIGNAL).fill(20)),
      ...saves("stat", Array(MIN_POSTS_FOR_SIGNAL).fill(21)),
    ];
    const read = readFormats(summariseFormats(rows));
    expect(read).toContain("running level");
    expect(read).not.toMatch(/\dx the saves/);
  });

  it("names the winner once the gap is wide enough to survive the sample", () => {
    const rows = [
      ...saves("daily", Array(MIN_POSTS_FOR_SIGNAL).fill(20)),
      ...saves("stat", Array(MIN_POSTS_FOR_SIGNAL).fill(60)),
    ];
    const read = readFormats(summariseFormats(rows));
    expect(read).toContain("The Number");
    expect(read).toContain("3.0x");
  });

  it("says so plainly when only one format has enough behind it", () => {
    const rows = [...saves("daily", Array(MIN_POSTS_FOR_SIGNAL).fill(20)), ...saves("stat", [60])];
    const read = readFormats(summariseFormats(rows));
    expect(read).toContain("Only Today's Briefing");
  });
});
