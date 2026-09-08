import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseCashRate } from "./lib/rbaCashRate";
// Exact first three columns and final five observations of RBA F1, fetched 2026-09-08.
const csv = readFileSync(new URL("./fixtures/rba-cash-daily.csv", import.meta.url), "utf8");
const now = new Date("2026-09-08T12:00:00Z");

it("reads the daily target from current unquoted RBA CSV and preserves its observation date", () => {
  expect(parseCashRate(csv, now)).toEqual({ rate: 4.35, asOf: new Date("2026-09-07") });
  expect(parseCashRate(csv.replace("07-Sep-2026,4.35", '"07-Sep-2026","4.35"'), now)).toEqual(
    parseCashRate(csv, now)
  );
});
it("does not substitute an older rate when the latest completed observation is missing", () => {
  expect(() => parseCashRate(csv.replace("07-Sep-2026,4.35", "07-Sep-2026,"), now)).toThrow(
    "unavailable"
  );
});
it("rejects the monthly series, changed identity, stale and future observations", () => {
  expect(() => parseCashRate(csv.replace("FIRMMCRTD", "FIRMMCRT"), now)).toThrow("series");
  expect(() => parseCashRate(csv.replace("Cash Rate Target", "Interbank rate"), now)).toThrow(
    "Title"
  );
  expect(() => parseCashRate(csv, new Date("2026-10-08"))).toThrow();
  expect(() => parseCashRate(csv.replace("08-Sep-2026,,", "09-Sep-2026,4.35,"), now)).toThrow(
    "future"
  );
});
