import fs from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseAbsApprovals, getCityApprovals } from "./absApprovals";
import { annualApprovals } from "../../shared/cityApprovals";
import { CityApprovalRead } from "../../shared/CityApprovalRead";
import { invalidate } from "../core/cache";

// Captured from the pinned ABS BA_GCCSA endpoint on 8 September 2026 (Sydney).
// Codelists: /rest/dataflow/ABS/BA_GCCSA/1.0.0?references=all.
const csv = fs.readFileSync(new URL("./fixtures/abs-approvals.csv", import.meta.url), "utf8");
const asOf = "2026-09-08";
afterEach(() => {
  vi.unstubAllGlobals();
  invalidate("abs:approvals:attempt");
  invalidate("abs:approvals:data");
});

describe("verified city approvals", () => {
  it("reproduces twelve-month counts from the captured official observations", () => {
    const data = parseAbsApprovals(csv, asOf);
    expect(annualApprovals(data, "Brisbane", asOf)).toMatchObject({
      total: 27628,
      period: "2026-07",
    });
    expect(annualApprovals(data, "Perth", asOf)).toMatchObject({ total: 22229, period: "2026-07" });
    expect(annualApprovals(data, "Townsville", asOf)).toBeNull();
  });
  it.each([
    [",1,1,9,TOT,TOT,10,", ",2,1,9,TOT,TOT,10,"],
    [",1,1,9,TOT,TOT,10,", ",1,1,1,TOT,TOT,10,"],
    [",1,1,9,TOT,TOT,10,", ",1,1,9,TOT,TOT,20,"],
    [",NUM,0,", ",AUD,0,"],
    [",NUM,0,", ",NUM,3,"],
    [",3GBRI,M,", ",3,M,"],
    ["ABS:BA_GCCSA(1.0.0)", "ABS:BA_GCCSA(2.0.0)"],
  ])("rejects changed identity %s -> %s", (before, after) => {
    expect(() => parseAbsApprovals(csv.replace(before, after), asOf)).toThrow("series");
  });
  it("does not turn suppressed, missing, negative or fractional counts into zero", () => {
    for (const replacement of [",,NUM,0,,", ",2486,NUM,0,c,", ",-1,NUM,0,,", ",2.5,NUM,0,,"]) {
      const data = parseAbsApprovals(csv.replace(",2486,NUM,0,,", replacement), asOf);
      expect(annualApprovals(data, "Brisbane", asOf)).toBeNull();
      expect(annualApprovals(data, "Perth", asOf)?.total).toBe(22229);
    }
  });
  it("withholds incomplete years, stale data and duplicate rows", () => {
    const data = parseAbsApprovals(csv, asOf);
    data.observations = data.observations.filter(
      (row) => !(row.city === "Brisbane" && row.period === "2026-01")
    );
    expect(annualApprovals(data, "Brisbane", asOf)).toBeNull();
    expect(annualApprovals(data, "Perth", "2026-12-01")).toBeNull();
    expect(() => parseAbsApprovals(csv + csv.split(/\r?\n/)[1] + "\n", asOf)).toThrow("Duplicate");
    expect(() => parseAbsApprovals(csv.replace("2026-07", "2026-13"), asOf)).toThrow("period");
  });
  it("keeps source, boundaries, date and limitations visible in server-rendered content", () => {
    const data = parseAbsApprovals(csv, asOf);
    const html = renderToStaticMarkup(
      createElement(CityApprovalRead, { data, cities: ["Brisbane", "Perth"], asOf })
    );
    expect(html).toContain("27,628");
    expect(html).toContain("22,229");
    expect(html).toContain("Greater");
    expect(html).toContain("July 2026");
    expect(html).toContain("not starts, completions");
    expect(html).toContain("not adjusted for population");
    expect(html).toContain("abs.gov.au");
    const incomplete = {
      ...data,
      observations: data.observations.filter(
        (row) => !(row.city === "Perth" && row.period === "2026-07")
      ),
    };
    const withheld = renderToStaticMarkup(
      createElement(CityApprovalRead, { data: incomplete, cities: ["Brisbane", "Perth"], asOf })
    );
    expect(withheld).not.toContain("27,628");
    expect(withheld).toContain("matching end month");
  });
  it("shows revisions/preliminary status in the annual result", () => {
    const data = parseAbsApprovals(csv.replace(",2486,NUM,0,,", ",2486,NUM,0,p,"), asOf);
    expect(annualApprovals(data, "Brisbane", asOf)?.preliminary).toBe(true);
  });
  it("rejects non-CSV and streamed responses above the byte bound", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(csv, { headers: { "content-type": "text/html" } }))
    );
    expect((await getCityApprovals()).status).toBe("unavailable");
    invalidate("abs:approvals:attempt");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response("x".repeat(64_001), { headers: { "content-type": "text/csv" } })
      )
    );
    expect((await getCityApprovals()).status).toBe("unavailable");
  });
});
