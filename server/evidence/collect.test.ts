import { beforeEach, expect, it, vi } from "vitest";
const writes = vi.hoisted(() => ({ values: [] as any[], updates: [] as any[] }));
vi.mock("../db/client", () => ({
  getDb: () => ({
    insert: () => ({
      values: (rows: unknown) => {
        writes.values.push(rows);
        return {
          onDuplicateKeyUpdate: async (update: unknown) => {
            writes.updates.push(update);
          },
        };
      },
    }),
  }),
}));
vi.mock("../../scripts/ingest/lib/rss", () => ({ fetchSourceReport: vi.fn() }));
import { fetchSourceReport } from "../../scripts/ingest/lib/rss";
import { STATE_PROPERTY_SOURCES } from "../../scripts/ingest/propertySources";
import { collectPropertyEvidence } from "./collect";

beforeEach(() => {
  vi.clearAllMocks();
  writes.values.length = 0;
  writes.updates.length = 0;
});
it("archives more than the front-page quota and persists partial feed failures", async () => {
  const items = Array.from({ length: 20 }, (_, i) => ({
    title: `Hobart housing supply update ${i}`,
    summary: "Tasmania rental vacancies fall.",
    source: "Fixture",
    url: `https://example.org/${i}`,
    isoDate: new Date(Date.now() - 86_400_000).toISOString(),
    category: "PROPERTY",
    channel: "PROPERTY",
    imageUrl: null,
  }));
  // The public Source shape does not include the registry id; use source name for the fixture.
  vi.mocked(fetchSourceReport).mockImplementation(async (source) =>
    source.name === STATE_PROPERTY_SOURCES[0]!.name
      ? { items, fetched: 20, error: null }
      : { items: [], fetched: 0, error: "failed" }
  );
  expect(await collectPropertyEvidence(STATE_PROPERTY_SOURCES.slice(0, 2))).toEqual({
    checked: 2,
    failed: 1,
  });
  expect(writes.values.find(Array.isArray)).toHaveLength(20);
  expect(writes.values.some((row) => row.error === "failed" && row.accepted === 0)).toBe(true);
  expect(fetchSourceReport).toHaveBeenCalledTimes(3);
});
it("fails the job when every feed fails, after recording each source status", async () => {
  vi.mocked(fetchSourceReport).mockResolvedValue({ items: [], fetched: 0, error: "failed" });
  await expect(collectPropertyEvidence(STATE_PROPERTY_SOURCES.slice(0, 2))).rejects.toThrow(
    "All property evidence sources failed"
  );
  expect(writes.values).toHaveLength(2);
});
