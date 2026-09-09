import { expect, it } from "vitest";
import { requestedLocalPeriods } from "./requestedPeriods";

it.each([
  ["Rents in postcode 2025", []],
  ["Rents in postcode 2000 in June 2025", ["2025-06"]],
  ["June quarter 2025 rents", ["2025-06"]],
  ["Q2 2025 rents", ["2025-06"]],
  ["Rents in Sep. 2025", ["2025-09"]],
  ["Compare June 2025 and June 2026", ["2025-06", "2026-06"]],
  ["Compare 2025 and 2026", ["2025", "2026"]],
  ["Reporting period 2025-06-30", ["2025-06-30"]],
  ["Reporting period 2025-06", ["2025-06"]],
] as const)(
  "preserves the requested reporting scope: %s",
  (question, periods) => {
    expect(requestedLocalPeriods(question)).toEqual(periods);
  },
);
