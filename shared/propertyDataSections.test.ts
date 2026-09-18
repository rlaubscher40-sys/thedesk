import { expect, it } from "vitest";
import { propertyDataSection } from "./propertyDataSections";
it.each([
  ["perth_approvals_12m", "PROPERTY", "supply"],
  ["sydney_rent_growth_annual", "PROPERTY", "rents"],
  ["cash_rate", "MACRO", "finance"],
  ["owner_occupier_new_lending_rate", "", "finance"],
  ["us_10y", "MARKETS", "macro"],
  ["unreviewed", "", "macro"],
])("places public series %s in %s / %s", (metricKey, groupKey, expected) => {
  expect(propertyDataSection({ metricKey, groupKey })).toBe(expected);
});
