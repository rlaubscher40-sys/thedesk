import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { StateLabourRead } from "./StateLabourRead";
import type { StateLabour } from "./stateLabour";
const data: StateLabour = {
  status: "available",
  period: "2026-07",
  retrievedAt: "2026-09-17T00:00:00Z",
  sourceUrl: "https://www.abs.gov.au/example",
  observations: [
    {
      state: "QLD",
      employedPeople: 3052100,
      employmentMonthlyPercent: 0.2,
      unemploymentPercent: 4.2,
      participationPercent: 67.1,
    },
  ],
};
it("displays boundary, trend basis, month, units and source", () => {
  const html = renderToStaticMarkup(
    createElement(StateLabourRead, { data, stateCode: "QLD", asOf: "2026-09-17" })
  );
  for (const label of [
    "Queensland",
    "3,052,100",
    "2026-07",
    "Whole state or territory",
    "not a city",
    "Trend",
    "monthly change",
    "not annual growth",
    data.sourceUrl,
  ])
    expect(html).toContain(label);
});
it("shows unavailable instead of another requested month or stale value", () => {
  for (const props of [{ period: "2026-06", asOf: "2026-09-17" }, { asOf: "2026-11-01" }]) {
    const html = renderToStaticMarkup(
      createElement(StateLabourRead, { data, stateCode: "QLD", ...props })
    );
    expect(html).toContain("unavailable");
    expect(html).not.toContain("3,052,100");
  }
});
