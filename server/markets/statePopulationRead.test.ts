import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatePopulationRead } from "../../shared/StatePopulationRead";
import { parseAbsDemographics } from "./absDemographics";

const retrievedAt = "2026-09-08T00:00:00.000Z";
const csv = readFileSync(new URL("./fixtures/abs-demographics.csv", import.meta.url), "utf8");
const contexts = [
  { state: "Queensland", market: "Brisbane" },
  { state: "Western Australia", market: "Perth" },
];

describe("state population comparison read", () => {
  it("shows official state context without relabelling it as city data", () => {
    const html = renderToStaticMarkup(
      React.createElement(StatePopulationRead, {
        data: parseAbsDemographics(csv, retrievedAt),
        contexts,
        asOf: "2026-09-08",
      })
    );
    expect(html).toContain("Queensland context for Brisbane");
    expect(html).toContain("Western Australia context for Perth");
    expect(html).toContain("+92,100 over the year");
    expect(html).toContain("+16,528");
    expect(html).toContain("+54,600");
    expect(html).toContain("not city population");
    expect(html).not.toContain("Brisbane population");
    expect(html).not.toContain("Perth population");
  });

  it("renders an explicit gap instead of stale or partial figures", () => {
    const html = renderToStaticMarkup(
      React.createElement(StatePopulationRead, { data: undefined, contexts, asOf: "2026-09-08" })
    );
    expect(html.match(/Current matching observations unavailable/g)).toHaveLength(2);
  });
});
