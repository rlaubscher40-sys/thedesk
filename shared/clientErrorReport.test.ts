import { expect, it } from "vitest";
import { clientErrorReport } from "./clientErrorReport";

it("removes signed-link values and credentials from every diagnostic field", () => {
  const link = "https://reader:password@thedesk.au/unsubscribe?token=signature#private";
  const report = clientErrorReport({
    message: `Failed to load ${link}`,
    stack: `Error: ${link}\n at read (https://thedesk.au/assets/app.js:12:34)\nurl: ${link}`,
    url: link,
  });
  expect(report.url).toBe("https://thedesk.au/unsubscribe");
  expect(report.stack).toContain("https://thedesk.au/assets/app.js:12:34");
  for (const secret of ["reader", "password", "signature", "private", "?token", "#"])
    expect(JSON.stringify(report)).not.toContain(secret);
});
it("redacts query-bearing relative and protocol-relative URLs, including Ask input", () => {
  const report = clientErrorReport({
    message: "Fetch /api/trpc/ask.answer?input=%7B%22q%22%3A%22private-question%22%7D failed",
    stack:
      "at load (//reader:password@thedesk.au/assets/app.js?token=private)\nurl: /ask?q=private#fragment",
    url: "https://thedesk.au/ask?q=private-question#fragment",
  });
  expect(report.message).toBe("Fetch /api/trpc/ask.answer failed");
  expect(report.stack).toBe("at load (//thedesk.au/assets/app.js)\nurl: /ask");
  expect(report.url).toBe("https://thedesk.au/ask");
});
it("bounds long reports to storage limits and drops unsupported locations", () => {
  const report = clientErrorReport({
    message: "m".repeat(20_000),
    stack: "s".repeat(40_000),
    url: "file:///private",
  });
  expect(report.message).toHaveLength(512);
  expect(report.stack).toHaveLength(8_000);
  expect(report.url).toBe("");
  expect(clientErrorReport({ message: "TypeError: missing field", stack: null })).toEqual({
    message: "TypeError: missing field",
    stack: null,
    url: "",
  });
});
it("does not alter normal error text and is safe to apply at both boundaries", () => {
  const input = {
    message: "Cannot read properties of undefined",
    stack: "TypeError\n at https://thedesk.au/assets/app.js:20:1",
    url: "https://thedesk.au/story/42?utm_source=ig",
  };
  const report = clientErrorReport(input);
  expect(report.message).toBe(input.message);
  expect(report.stack).toBe(input.stack);
  expect(clientErrorReport(report)).toEqual(report);
});
