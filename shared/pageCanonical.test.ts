import { expect, it } from "vitest";
import { pageCanonical } from "./pageCanonical";
it("keeps distinct signal snapshots while dropping tracking", () => {
  expect(pageCanonical("/signals", "?metric=cash_rate&snapshot=abc&view=chart&utm_source=ig")).toBe(
    "https://thedesk.au/signals?metric=cash_rate&snapshot=abc&view=chart"
  );
  expect(pageCanonical("/brief", "?t=token&fbclid=abc")).toBe("https://thedesk.au/brief?t=token");
});
it("consolidates interactive filters and trailing slashes", () => {
  expect(pageCanonical("/markets/", "?q=Perth&rentPeriod=2026-07")).toBe(
    "https://thedesk.au/markets"
  );
  expect(pageCanonical("/topics/PROPERTY")).toBe("https://thedesk.au/topics/PROPERTY");
});
