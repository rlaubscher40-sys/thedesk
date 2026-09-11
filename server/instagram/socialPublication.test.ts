import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyFeedItem } from "../db/schema";
const m = vi.hoisted(() => ({ read: vi.fn(), reserve: vi.fn(), confirm: vi.fn() }));
vi.mock("../db/socialPublication", () => ({
  readSocialRecords: m.read,
  reserveSocialRecords: m.reserve,
  confirmSocialRecords: m.confirm,
}));
import {
  publishSocialOnce,
  recoverSocialPublication,
  socialSlotKey,
  unpublishedSocialStories,
} from "./socialPublication";
import { storyPublicationKeys } from "./socialProvenance";
const story = {
  id: 42,
  feedDate: "2026-09-08",
  createdAt: new Date("2026-09-07T20:43:00Z"),
  title: "Sydney rents rose 3.5%",
  sourceUrl: "https://abs.gov.au/rents",
} as DailyFeedItem;
const records = new Map<string, { jobKey: string; status: string; detail: string }>();
beforeEach(() => {
  vi.resetAllMocks();
  records.clear();
  m.read.mockImplementation(async (keys: string[]) =>
    keys.flatMap((key) => (records.has(key) ? [records.get(key)] : []))
  );
  m.reserve.mockImplementation(async (keys: string[]) => {
    if (keys.some((key) => records.has(key))) throw new Error("Claim lost");
    keys.forEach((key) =>
      records.set(key, { jobKey: key, status: "running", detail: "uncertain" })
    );
  });
  m.confirm.mockImplementation(async (keys: string[], detail: string) =>
    keys.forEach((key) => records.set(key, { jobKey: key, status: "success", detail }))
  );
});
describe("permanent carousel publication identities", () => {
  it("locks all stories across daily/weekly runs and recovers only its exact slot receipt", async () => {
    await publishSocialOnce("daily:2026-09-08", [story], story.title, async () => "123", "light");
    expect(await unpublishedSocialStories([story])).toEqual([]);
    expect(await recoverSocialPublication("daily:2026-09-08")).toEqual({
      postId: "123",
      headline: story.title,
      coverVariant: "light",
    });
    expect(await recoverSocialPublication("weekly:2026-09-07")).toBeNull();
    expect(storyPublicationKeys(story).every((key) => key.length === 64)).toBe(true);
    expect(JSON.parse(records.get(socialSlotKey("daily:2026-09-08"))!.detail).storyIds).toEqual([
      42,
    ]);
    expect(
      JSON.parse(records.get(socialSlotKey("daily:2026-09-08"))!.detail).storyEvidence
    ).toEqual([
      {
        id: 42,
        feedDate: "2026-09-08",
        importedAt: "2026-09-07T20:43:00.000Z",
        sourceTiming: null,
      },
    ]);
  });
  it("never retries an uncertain Meta response, including after restart", async () => {
    const publish = vi.fn().mockRejectedValue(new Error("response lost"));
    await expect(
      publishSocialOnce("daily:2026-09-08", [story], story.title, publish)
    ).rejects.toThrow("response lost");
    await expect(recoverSocialPublication("daily:2026-09-08")).rejects.toThrow("uncertain");
    await expect(
      publishSocialOnce("daily:2026-09-08", [story], story.title, publish)
    ).rejects.toThrow("Claim lost");
    expect(publish).toHaveBeenCalledOnce();
  });
  it("only one simultaneous claimant can call Meta", async () => {
    const publish = vi.fn().mockResolvedValue("123");
    const results = await Promise.allSettled(
      ["daily:2026-09-08", "weekly:2026-09-07"].map((scope) =>
        publishSocialOnce(scope, [story], story.title, publish)
      )
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(publish).toHaveBeenCalledOnce();
  });
  it("blocks database failures and malformed receipts, never selecting recent unrelated media", async () => {
    m.read.mockRejectedValueOnce(new Error("DB unavailable"));
    await expect(unpublishedSocialStories([story])).rejects.toThrow("DB unavailable");
    records.set(socialSlotKey("daily:x"), {
      jobKey: socialSlotKey("daily:x"),
      status: "success",
      detail: "not a receipt",
    });
    await expect(recoverSocialPublication("daily:x")).rejects.toThrow("uncertain");
    m.reserve.mockRejectedValue(new Error("DB unavailable"));
    const publish = vi.fn();
    await expect(publishSocialOnce("daily:y", [story], story.title, publish)).rejects.toThrow();
    expect(publish).not.toHaveBeenCalled();
  });
  it("keeps the lock when recording a confirmed response fails", async () => {
    m.confirm.mockRejectedValue(new Error("write lost"));
    await expect(
      publishSocialOnce("daily:x", [story], story.title, async () => "123")
    ).rejects.toThrow("write lost");
    await expect(recoverSocialPublication("daily:x")).rejects.toThrow("uncertain");
  });
  it("deduplicates URL variants and exact syndication headlines without padding empty days", async () => {
    expect(
      await unpublishedSocialStories([
        story,
        { ...story, sourceUrl: story.sourceUrl + "?utm_source=ig" },
        { ...story, sourceUrl: "https://news.example/same" },
      ])
    ).toEqual([story]);
  });
});
