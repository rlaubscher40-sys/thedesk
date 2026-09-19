import { expect, it } from "vitest";
import { documentaryRunway } from "./documentaryRunway";
const now = new Date("2026-09-19T23:00:00Z"); // Already Sep 20 in Sydney.
const episode = {
  id: "one",
  title: "One",
  releaseDate: "2026-09-20",
  exportRegistered: true,
  state: "available",
};
it("uses Sydney dates and separates published, missed, held and unregistered exports", () => {
  const report = documentaryRunway(
    [
      episode,
      { ...episode, id: "past", releaseDate: "2026-09-19" },
      { ...episode, id: "published", state: "published" },
      { ...episode, id: "uncertain", state: "unavailable" },
      { ...episode, id: "locked", state: "locked" },
      { ...episode, id: "draft", exportRegistered: false },
      { ...episode, id: "unscheduled", releaseDate: null },
    ],
    now
  );
  expect(report.rows.map((row) => row.status)).toEqual([
    "scheduled",
    "missed-slot",
    "published",
    "unknown",
    "publication-held",
    "export-needed",
    "unscheduled",
  ]);
  expect(report).toMatchObject({
    readyCount: 1,
    daysRemaining: 0,
    uncertain: true,
    needsProduction: true,
  });
});
it("starts replenishment before either the count or two-week runway runs out", () => {
  const four = [21, 23, 27, 30].map((day) => ({
    ...episode,
    id: String(day),
    releaseDate: `2026-09-${day}`,
  }));
  expect(documentaryRunway(four, now)).toMatchObject({
    readyCount: 4,
    daysRemaining: 10,
    needsProduction: true,
  });
  expect(
    documentaryRunway(
      four.map((row) => ({ ...row, releaseDate: "2026-10-04" })),
      now
    ).needsProduction
  ).toBe(false);
});
