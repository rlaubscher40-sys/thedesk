import { describe, expect, it, vi, afterEach } from "vitest";
vi.mock("./publicFetch", () => ({
  publicFetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
}));
import {
  extractResearchPdf,
  isResearchPdfUrl,
  researchPdfDate,
  researchPdfText,
} from "./researchPdf";
import { fetchArticle } from "./article";
const url = "https://sqmresearch.com.au/uploads/13-08-26-National-Vacancy-Rates-July-2026-2038.pdf";
// Original synthetic PDF fixture: no publisher text, statistics or artwork.
function pdf(pages = 2): Uint8Array {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${4 + i * 2} 0 R`).join(" ")}] /Count ${pages} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  for (let i = 0; i < pages; i++) {
    const lines = i
      ? ["LATER PAGE CHART VALUES MUST NOT BECOME NARRATIVE"]
      : [
          "Synthetic housing research release",
          "13 August 2026",
          "Key Points",
          "Australian rental research explains its findings and limitations.",
          "The reporting month is July 2026 and differs from the release day.",
        ];
    const stream = `BT /F1 12 Tf 50 700 Td 18 TL ${lines.map((line, j) => `${j ? "T* " : ""}(${line}) Tj`).join("\n")} ET`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
    );
  }
  let text = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(text));
    text += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(text);
  text +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
      .join("") +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(text));
}
afterEach(() => vi.unstubAllGlobals());
describe("bounded research PDF extraction", () => {
  it("extracts opening-page evidence with a real parser and preserves release-day precision", async () => {
    const result = await extractResearchPdf(pdf(), url);
    expect(result.publicationDate).toEqual({
      publisherPublishedAt: null,
      publisherPublishedDay: "2026-08-13",
      publisherDateStatus: "available",
    });
    expect(result.text).toContain("Australian rental research");
    expect(result.text).toContain("July 2026");
    expect(result.text).not.toContain("LATER PAGE");
  });
  it("fetches an approved PDF through the existing bounded public transport", async () => {
    const request = vi.fn(
      async () => new Response(pdf(), { headers: { "content-type": "application/pdf" } })
    );
    vi.stubGlobal("fetch", request);
    const result = await fetchArticle(url);
    expect(result.text).toContain("Australian rental research");
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0]?.[1]).toMatchObject({ maxBytes: 2 * 1024 * 1024 });
    expect((await fetchArticle("https://unreviewed.example/report.pdf")).text).toBeNull();
  });
  it("rejects malformed, oversized and overlong documents and enforces worker termination", async () => {
    for (const bytes of [
      new Uint8Array(Buffer.from("%PDF-invalid")),
      new Uint8Array(2 * 1024 * 1024 + 1),
      pdf(9),
    ])
      expect((await extractResearchPdf(bytes, url)).text).toBeNull();
    expect((await extractResearchPdf(pdf(), url, { timeoutMs: 1 })).text).toBeNull();
    expect((await extractResearchPdf(pdf(), url, { maxChars: 30 })).text?.length).toBe(30);
  });
  it("accepts split date glyphs only with matching dated release URLs", () => {
    expect(
      researchPdfDate("Research release\n1 3   August   2026\nKey Points\nJuly 2026", url)
        .publisherPublishedDay
    ).toBe("2026-08-13");
    expect(
      researchPdfDate("Research release\n12 August 2026\nKey Points", url).publisherDateStatus
    ).toBe("conflicting");
    expect(
      researchPdfDate("Research release\n31 September 2026\nKey Points", url).publisherDateStatus
    ).toBe("invalid");
    expect(
      researchPdfDate("Research release\nJuly 2026\nKey Points", url).publisherDateStatus
    ).toBe("missing");
    expect(
      researchPdfDate("13 August 2026\n14 August 2026\nKey Points", url).publisherDateStatus
    ).toBe("conflicting");
    expect(
      isResearchPdfUrl(url.replace("sqmresearch.com.au", "sqmresearch.com.au.example.com"))
    ).toBe(false);
    expect(isResearchPdfUrl(url.replace("https:", "http:"))).toBe(false);
  });
  it("removes headers and chart/methodology furniture while retaining opening findings", () => {
    expect(
      researchPdfText(
        "Page 1 of 5\nResearch\n1 3 August 2026\nKey Points\n• First finding wraps\nonto another line.\n• Second finding.\nSQM’s calculations of vacancies should stop here"
      )
    ).toBe("First finding wraps onto another line.\n\nSecond finding.");
  });
});
