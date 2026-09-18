import { expect, it } from "vitest";
import { newsletterPreview } from "./newsletterPreviews";
it("renders both real email layouts with labelled examples and no personal unsubscribe token", () => {
  const daily = newsletterPreview("daily", "https://thedesk.au");
  const sunday = newsletterPreview("sunday", "https://thedesk.au");
  expect(daily).toContain("AFG continues run");
  expect(daily).toContain("One published story");
  expect(sunday).toContain("Edition #17 is ready.");
  expect(sunday).toContain("https://thedesk.au/editions/17");
  for (const html of [daily, sunday]) {
    expect(html).toContain("No email has been sent.");
    expect(html).toContain('href="#preview-unsubscribe"');
    expect(html).not.toContain("preview@example.invalid");
    expect(html).not.toMatch(/unsubscribe\?t=/);
  }
});
