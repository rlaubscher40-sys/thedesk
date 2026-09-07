import { describe, expect, it } from "vitest";
import { extractStateFigures, flattenHtml, looksLikeInterstateMigration } from "./absStates";

/** Shaped like an ABS table: labels and values in separate cells, a bracketed
 *  negative, and a thousands separator. */
const TABLE = `
<table><tbody>
  <tr><th>New South Wales</th><td>(21,465)</td></tr>
  <tr><th>Victoria</th><td>(4,120)</td></tr>
  <tr><th>Queensland</th><td>25,310</td></tr>
  <tr><th>South Australia</th><td>1,140</td></tr>
  <tr><th>Western Australia</th><td>5,200</td></tr>
  <tr><th>Tasmania</th><td>(1,050)</td></tr>
  <tr><th>Northern Territory</th><td>(2,015)</td></tr>
  <tr><th>Australian Capital Territory</th><td>(3,000)</td></tr>
</tbody></table>`;

describe("flattenHtml", () => {
  it("drops tags without gluing neighbouring text together", () => {
    expect(flattenHtml("<th>Victoria</th><td>1,234</td>")).toBe("Victoria 1,234");
  });

  it("normalises the dash characters ABS uses for negatives", () => {
    expect(flattenHtml("<td>&minus;1,234</td>")).toBe("-1,234");
    expect(flattenHtml("<td>−1,234</td>")).toBe("-1,234");
  });

  it("strips scripts so a number inside one cannot be read as data", () => {
    expect(flattenHtml("<script>var x = 99999;</script><th>Victoria</th><td>1,234</td>")).toBe(
      "Victoria 1,234"
    );
  });
});

describe("extractStateFigures", () => {
  it("finds every jurisdiction and its figure", () => {
    const figures = extractStateFigures(TABLE);
    expect(figures).toHaveLength(8);
    const nsw = figures.find((f) => f.code === "NSW")!;
    expect(nsw.value).toBe(-21465);
    expect(figures.find((f) => f.code === "QLD")!.value).toBe(25310);
  });

  it("reads a bracketed figure as negative", () => {
    // A state losing 21,465 people and one gaining them are opposite stories.
    expect(extractStateFigures(TABLE).find((f) => f.code === "NSW")!.value).toBeLessThan(0);
  });

  it("does not mistake the ACT for Australia in a naive name scan", () => {
    const figures = extractStateFigures(TABLE);
    expect(figures.find((f) => f.code === "ACT")!.value).toBe(-3000);
  });

  it("keeps South Australia and Western Australia distinct", () => {
    const figures = extractStateFigures(TABLE);
    expect(figures.find((f) => f.code === "SA")!.value).toBe(1140);
    expect(figures.find((f) => f.code === "WA")!.value).toBe(5200);
  });

  it("reports a partial table as partial rather than padding it with zeroes", () => {
    // A missing state is a broken pattern. Publishing "Tasmania: 0" because a
    // regex drifted would be a fabricated number on a series whose entire value
    // is that its numbers are real.
    const partial = TABLE.replace(/<tr><th>Tasmania<\/th><td>\(1,050\)<\/td><\/tr>/, "");
    const figures = extractStateFigures(partial);
    expect(figures).toHaveLength(7);
    expect(figures.some((f) => f.code === "TAS")).toBe(false);
  });

  it("ignores a number that sits too far from its label to be its figure", () => {
    const far = `<th>Tasmania</th><td>${"filler text ".repeat(30)}</td><td>1,050</td>`;
    expect(extractStateFigures(far).some((f) => f.code === "TAS")).toBe(false);
  });
});

describe("looksLikeInterstateMigration", () => {
  it("accepts a table that balances, because interstate migration must", () => {
    // Net interstate migration is a transfer between states, so the figures sum
    // to about zero. That is a free correctness check on the whole extraction.
    expect(looksLikeInterstateMigration(extractStateFigures(TABLE))).toBe(true);
  });

  it("rejects a table that does not balance, meaning the wrong column was read", () => {
    const wrongColumn = TABLE.replace(/\((\d[\d,]*)\)/g, "$1"); // all positive
    expect(looksLikeInterstateMigration(extractStateFigures(wrongColumn))).toBe(false);
  });

  it("rejects an incomplete table outright", () => {
    const partial = TABLE.replace(/<tr><th>Tasmania<\/th><td>\(1,050\)<\/td><\/tr>/, "");
    expect(looksLikeInterstateMigration(extractStateFigures(partial))).toBe(false);
  });
});
