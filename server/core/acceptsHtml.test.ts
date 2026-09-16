import { it, expect } from "vitest";
import { acceptsHtml } from "./acceptsHtml";
it.each([
  undefined,
  "",
  "*/*",
  "text/*",
  "text/html",
  "TEXT/HTML; q=0.8",
  "application/json, */*;q=0.1",
])("serves metadata for HTML-compatible accept %s", (header) =>
  expect(acceptsHtml(header)).toBe(true)
);
it.each([
  "application/json",
  "image/*",
  "*/*;q=0",
  "text/html;q=0, */*;q=1",
  "text/html;q=bad",
  "text/html;q=2",
])("does not override explicit HTML rejection %s", (header) =>
  expect(acceptsHtml(header)).toBe(false)
);
