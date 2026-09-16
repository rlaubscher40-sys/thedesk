import { expect, it } from "vitest";
import { describeScheduledOutcome } from "./outcome";
it("separates intentional skips, confirmed media and HTTP success without evidence", () => {
  expect(
    describeScheduledOutcome("instagram-stat", {
      success: true,
      skipped: true,
      reason: "No eligible change",
    })
  ).toBe("Intentionally skipped: No eligible change");
  expect(describeScheduledOutcome("instagram-daily", { postId: "12345" })).toBe(
    "Confirmed publication: 12345"
  );
  expect(describeScheduledOutcome("instagram-daily", { success: true })).toContain("not confirmed");
  expect(describeScheduledOutcome("instagram-daily", { postId: "token-secret" })).not.toContain(
    "token-secret"
  );
});
