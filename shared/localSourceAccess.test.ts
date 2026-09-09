import { expect, it } from "vitest";
import {
  localSourceAccessDenied,
  pausedLocalSourceJobs,
} from "./localSourceAccess";

it("recognises legacy and staged access denials only", () => {
  for (const message of [
    "Publisher HTTP 403",
    "Source discovery: Publisher HTTP 401 (data.sa.gov.au)",
    "Data download: Publisher HTTP 403 (data.sa.gov.au)",
  ])
    expect(localSourceAccessDenied(message)).toBe(true);
  for (const message of [
    null,
    "Publisher HTTP 429",
    "Publisher HTTP 500",
    "Publisher HTTP 4030",
    "Storage unavailable",
    "Schema changed",
    "This operation was aborted",
    "Source URL is outside the registered publisher",
    "Parser found text Publisher HTTP 403",
  ])
    expect(localSourceAccessDenied(message)).toBe(false);
});
it("skips denied sources across days without affecting healthy sources", () => {
  expect([
    ...pausedLocalSourceJobs([
      { sourceKey: "sa-bond-rents", error: "Publisher HTTP 403" },
      { sourceKey: "wa-bond-rents", error: null },
      {
        sourceKey: "tas-bond-rents",
        error: "Data download: Publisher HTTP 500",
      },
    ]),
  ]).toEqual(["local-data-sa-bond-rents"]);
});
