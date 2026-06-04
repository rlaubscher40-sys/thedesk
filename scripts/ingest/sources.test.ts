/**
 * Integrity guards for the ingest source list. `scripts/` isn't covered by
 * `pnpm check` (tsconfig excludes it) and the ingest only runs via `tsx`
 * (which strips types without checking), so these runtime assertions are the
 * safety net that stops a malformed source/channel config from silently
 * shipping a broken — or empty — Discover lane.
 */
import { describe, it, expect } from "vitest";
import { FEED_CHANNELS, isEnrichedChannel } from "../../shared/const";
import { CHANNEL_TARGETS, DAILY_ITEM_MIN, SOURCES } from "./sources";

describe("ingest sources", () => {
  it("tags every source with a valid channel", () => {
    for (const s of SOURCES) {
      expect(
        (FEED_CHANNELS as readonly string[]).includes(s.channel),
        `source "${s.name}" has unknown channel "${s.channel}"`
      ).toBe(true);
    }
  });

  it("gives every channel at least one source", () => {
    for (const channel of FEED_CHANNELS) {
      const count = SOURCES.filter((s) => s.channel === channel).length;
      expect(count, `channel "${channel}" has no sources`).toBeGreaterThan(0);
    }
  });

  it("has a positive item target for every channel", () => {
    for (const channel of FEED_CHANNELS) {
      expect(CHANNEL_TARGETS[channel], `no target for "${channel}"`).toBeGreaterThan(0);
    }
  });

  it("keeps the AU flagship target above the ship-or-abort floor", () => {
    // If AU's quota were below DAILY_ITEM_MIN, a full slate could still trip
    // the "thin day" abort — a config that can never succeed.
    expect(CHANNEL_TARGETS.AU).toBeGreaterThanOrEqual(DAILY_ITEM_MIN);
  });

  it("gives the enriched lanes (AU + Property) real sourcing", () => {
    // The partner product lives in the enriched lanes; guard against a refactor
    // that accidentally strips them down to nothing.
    for (const channel of ["AU", "PROPERTY"]) {
      const count = SOURCES.filter((s) => s.channel === channel).length;
      expect(count, `enriched channel "${channel}" has no sources`).toBeGreaterThan(0);
      expect(isEnrichedChannel(channel)).toBe(true);
    }
  });

  it("has no duplicate source names", () => {
    const names = SOURCES.map((s) => s.name);
    expect(new Set(names).size, "duplicate source name").toBe(names.length);
  });

  it("gives every source a non-empty name and http(s) url", () => {
    for (const s of SOURCES) {
      expect(s.name.trim().length, "empty source name").toBeGreaterThan(0);
      expect(/^https?:\/\//.test(s.url), `bad url for "${s.name}": ${s.url}`).toBe(true);
    }
  });
});
