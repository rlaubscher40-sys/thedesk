import { expect, it } from "vitest";
import { buildDailyBrief } from "./editorialPipeline";
import { editorialReportSchema } from "../../../shared/editorial";
import { SOURCES } from "../sources";
import { STATE_PROPERTY_SOURCES } from "../propertySources";

it("accepts every configured source outcome plus an unavailable evidence pool without dropping diagnostics", async () => {
  const { report } = await buildDailyBrief({
    readSource: async () => ({
      items: [],
      fetched: 0,
      error: "Source not read in inventory contract test",
    }),
  });
  expect(report.sources).toHaveLength(SOURCES.length + STATE_PROPERTY_SOURCES.length);
  report.sources.push({
    name: "Hourly evidence pool",
    url: "https://thedesk.au/api/ingest/editorial-candidates",
    fetched: 0,
    error: "Evidence pool unavailable; direct discovery continued",
  });
  const saved = editorialReportSchema.parse(report);
  expect(saved.sources).toEqual(report.sources);
  // The endpoint remains bounded even as the configured inventory grows.
  expect(
    editorialReportSchema.safeParse({
      ...report,
      sources: Array.from({ length: 201 }, () => report.sources[0]),
    }).success
  ).toBe(false);
});
