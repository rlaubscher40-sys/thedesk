import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const m = vi.hoisted(() => ({ editions: vi.fn(), byCategory: vi.fn() }));
vi.mock("../db", () => ({ listEditions: m.editions, getFeedItemsByCategory: m.byCategory }));

import { registerSeoRoutes } from "./seo";
import {
  RELEASE_CALENDAR_CSV_COLUMNS,
  RESEARCH_REUSE_TERMS,
  TOPIC_FEEDS,
  csvField,
} from "../../shared/topicFeeds";
import { RELEASE_EVENTS } from "../../shared/releaseCalendar";

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  registerSeoRoutes(app);
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  vi.clearAllMocks();
  m.editions.mockResolvedValue([]);
  m.byCategory.mockResolvedValue([
    {
      id: 42,
      title: "Approvals fell in the June quarter",
      summary:
        "The ABS reported fewer dwelling approvals. Get our breaking news email, free app or daily news podcast",
      feedDate: "2026-09-12",
      category: "PROPERTY",
    },
  ]);
});

describe("topic feeds", () => {
  it("serves one feed per declared topic, scoped to its category", async () => {
    for (const feed of TOPIC_FEEDS) {
      const response = await fetch(`${base}/feeds/${feed.slug}.xml`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/rss+xml");
      // Discovery feeds are not search-result landing pages.
      expect(response.headers.get("x-robots-tag")).toContain("noindex");
      const xml = await response.text();
      expect(xml).toContain(`<title>The Desk · ${feed.title}</title>`);
      // XML-escaped in the channel description, so compare on a distinctive clause.
      expect(xml).toContain(feed.description.split("'")[0]!.trim());
      expect(m.byCategory).toHaveBeenCalledWith(feed.category, 50);
    }
  });

  it("links each item to The Desk's story page, where the publisher is credited", async () => {
    const xml = await (await fetch(`${base}/feeds/property.xml`)).text();
    expect(xml).toContain('<guid isPermaLink="true">');
    expect(xml).toContain("/story/42");
    expect(xml).toContain("Approvals fell in the June quarter");
    expect(xml).toContain("Sat, 12 Sep 2026");
  });

  it("strips a publisher's promotion from the excerpt it carries", async () => {
    const xml = await (await fetch(`${base}/feeds/property.xml`)).text();
    expect(xml).toContain("The ABS reported fewer dwelling approvals.");
    expect(xml).not.toMatch(/breaking news email/i);
  });

  it("404s an unknown topic instead of serving an empty feed", async () => {
    expect((await fetch(`${base}/feeds/made-up.xml`)).status).toBe(404);
    expect((await fetch(`${base}/feeds/PROPERTY.xml`)).status).toBe(404);
    expect(m.byCategory).not.toHaveBeenCalled();
  });

  it("answers 503 rather than an empty feed when the archive is unavailable", async () => {
    m.byCategory.mockRejectedValue(new Error("DB unavailable"));
    const response = await fetch(`${base}/feeds/property.xml`);
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});

describe("release calendar as data", () => {
  it("serves a CSV with a row per release and every metadata column", async () => {
    const response = await fetch(`${base}/research/release-calendar.csv`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain("the-desk-release-calendar.csv");
    const lines = (await response.text()).split("\r\n");
    expect(lines).toHaveLength(RELEASE_EVENTS.length + 1);
    expect(lines[0]).toBe(
      '"id","publisher","release","what_it_measures","geography","unit","observation_period","cadence","date_status","scheduled_sydney","confirmed_from","last_checked_on","source_url","source_calendar_url","reuse"'
    );
  });

  it("carries the reuse terms and the publisher's own links on every row", async () => {
    const csv = await (await fetch(`${base}/research/release-calendar.csv`)).text();
    for (const event of RELEASE_EVENTS) {
      expect(csv).toContain(event.sourceCalendarUrl);
      expect(csv).toContain(event.publisher);
    }
    expect(
      csv
        .split("\r\n")
        .slice(1)
        .every((line) => line.includes("attribution to The Desk"))
    ).toBe(true);
    expect(RESEARCH_REUSE_TERMS).toContain("belong to the publishers named in the source column");
  });

  it("leaves the scheduled column empty rather than filling in a date it has not confirmed", async () => {
    const csv = await (await fetch(`${base}/research/release-calendar.csv`)).text();
    for (const line of csv.split("\r\n").slice(1)) {
      expect(line).toContain('"not-confirmed"');
      // The scheduled_sydney and confirmed_from columns stay empty.
      expect(line).toContain('"not-confirmed","","",');
    }
  });

  it("quotes every field so a comma or a formula cannot reshape the file", async () => {
    const csv = await (await fetch(`${base}/research/release-calendar.csv`)).text();
    const columns = RELEASE_CALENDAR_CSV_COLUMNS.length;
    for (const line of csv.split("\r\n")) {
      expect(line.startsWith('"')).toBe(true);
      expect(line.endsWith('"')).toBe(true);
      // Every field is quoted, so the separators are exactly `","` and a comma
      // inside a description cannot add a column.
      expect(line.split('","')).toHaveLength(columns);
    }
    // And a value that would execute in a spreadsheet is neutralised.
    expect(csvField("=cmd|'/c calc'!A1")).toBe(`"'=cmd|'/c calc'!A1"`);
    expect(csvField('say "hi", then go')).toBe('"say ""hi"", then go"');
    expect(csvField(null)).toBe('""');
  });
});
