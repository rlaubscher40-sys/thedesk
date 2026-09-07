import { describe, expect, it } from "vitest";
import { absDataUrl, latestObservation, parseSdmxCsv, sortByPeriod, splitCsvLine } from "./absApi";

/** Shaped like an ABS SDMX-CSV response: a DATAFLOW column, several dimensions,
 *  then the two columns the format guarantees. */
const CSV = [
  "DATAFLOW,FREQ,MEASURE,REGION,TIME_PERIOD,OBS_VALUE,UNIT_MEASURE",
  "ABS:X(1.0.0),Q,NIM,NSW,2025-Q4,-21465,NUM",
  "ABS:X(1.0.0),Q,NIM,QLD,2025-Q4,25310,NUM",
  "ABS:X(1.0.0),Q,NIM,NSW,2026-Q1,-18200,NUM",
].join("\n");

describe("splitCsvLine", () => {
  it("splits a plain row", () => {
    expect(splitCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("keeps a comma inside a quoted field", () => {
    // Dimension labels routinely contain commas. A naive split shifts every
    // column after the first quoted one and corrupts values without erroring.
    expect(splitCsvLine('a,"Territory, ACT",c')).toEqual(["a", "Territory, ACT", "c"]);
  });

  it("reads a doubled quote as one literal quote", () => {
    expect(splitCsvLine('a,"say ""hi""",c')).toEqual(["a", 'say "hi"', "c"]);
  });

  it("preserves empty fields so column positions do not shift", () => {
    expect(splitCsvLine("a,,c")).toEqual(["a", "", "c"]);
  });
});

describe("parseSdmxCsv", () => {
  it("reads every observation with its dimensions", () => {
    const rows = parseSdmxCsv(CSV);
    expect(rows).toHaveLength(3);
    expect(rows[0]!.value).toBe(-21465);
    expect(rows[0]!.period).toBe("2025-Q4");
    expect(rows[0]!.dimensions.REGION).toBe("NSW");
    expect(rows[0]!.dimensions.UNIT_MEASURE).toBe("NUM");
  });

  it("reads columns from the header rather than assuming an order", () => {
    // Every dataflow has its own dimensions, so only TIME_PERIOD and OBS_VALUE
    // can be relied on to exist.
    const reordered = ["OBS_VALUE,REGION,TIME_PERIOD", "42,VIC,2026-Q1"].join("\n");
    const rows = parseSdmxCsv(reordered);
    expect(rows[0]!.value).toBe(42);
    expect(rows[0]!.period).toBe("2026-Q1");
    expect(rows[0]!.dimensions.REGION).toBe("VIC");
  });

  it("returns nothing when the guaranteed columns are absent", () => {
    expect(parseSdmxCsv("A,B\n1,2")).toEqual([]);
  });

  it("returns nothing for an empty or header-only response", () => {
    expect(parseSdmxCsv("")).toEqual([]);
    expect(parseSdmxCsv("TIME_PERIOD,OBS_VALUE")).toEqual([]);
  });

  it("drops an unpublished observation rather than reading it as zero", () => {
    // ABS marks unavailable observations with flags, not figures. Turning "not
    // published" into 0 would put a fabricated number into the series.
    const withGap = [
      "REGION,TIME_PERIOD,OBS_VALUE",
      "NSW,2026-Q1,",
      "NSW,2026-Q2,na",
      "NSW,2026-Q3,100",
    ].join("\n");
    const rows = parseSdmxCsv(withGap);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.value).toBe(100);
  });

  it("keeps a negative value negative", () => {
    // A state losing 21,465 people and one gaining them are opposite stories.
    expect(parseSdmxCsv(CSV)[0]!.value).toBeLessThan(0);
  });

  it("tolerates carriage returns", () => {
    expect(parseSdmxCsv("TIME_PERIOD,OBS_VALUE\r\n2026,5\r\n")).toHaveLength(1);
  });
});

describe("sortByPeriod / latestObservation", () => {
  it("orders oldest first, since the API does not guarantee an order", () => {
    const periods = sortByPeriod(parseSdmxCsv(CSV)).map((r) => r.period);
    expect(periods[periods.length - 1]).toBe("2026-Q1");
  });

  it("returns the most recent observation", () => {
    expect(latestObservation(parseSdmxCsv(CSV))!.period).toBe("2026-Q1");
  });

  it("returns null for an empty series rather than throwing", () => {
    expect(latestObservation([])).toBeNull();
  });
});

describe("absDataUrl", () => {
  it("asks for CSV and defaults to the whole flow", () => {
    const url = absDataUrl({ flowRef: "ABS,SOME_FLOW,1.0.0" });
    expect(url).toContain("format=csv");
    expect(url).toContain("/data/");
    expect(url).toContain("all");
  });

  it("passes a start period through when one is given", () => {
    // This is the point of the API over scraping: decades in one call.
    expect(absDataUrl({ flowRef: "F", startPeriod: "2000" })).toContain("startPeriod=2000");
  });

  it("encodes a flow reference containing commas", () => {
    expect(absDataUrl({ flowRef: "ABS,X,1.0.0" })).toContain("ABS%2CX%2C1.0.0");
  });
});
