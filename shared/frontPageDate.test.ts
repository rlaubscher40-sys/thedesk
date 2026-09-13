import { expect, it } from "vitest";
import { frontPageDate } from "./frontPageDate";
it("keeps the latest filing at midnight and across days without new reporting", () => {
  expect(frontPageDate("2026-09-14", null, ["2026-09-13", "2026-09-12"])).toBe("2026-09-13");
  expect(frontPageDate("2026-09-14", null, ["2026-09-11"])).toBe("2026-09-11");
  expect(frontPageDate("2026-09-14", null, ["2026-09-13", "2026-09-14"])).toBe("2026-09-14");
});
it("honours explicit dates even if empty, ignores future filings and supports empty lanes", () => {
  expect(frontPageDate("2026-09-14", "2026-09-14", ["2026-09-13"])).toBe("2026-09-14");
  expect(frontPageDate("2026-09-14", "2026-09-10", ["2026-09-13"])).toBe("2026-09-10");
  expect(frontPageDate("2026-09-14", null, ["2026-09-15", "2026-09-13"])).toBe("2026-09-13");
  expect(frontPageDate("2026-09-14", null, [])).toBe("2026-09-14");
});
