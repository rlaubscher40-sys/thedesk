import { describe, expect, it } from "vitest";
import { extractHookStat, renderDailyHookCoverCard } from "./dailyHookCover";

function expectJpeg(buf: Buffer) {
  expect(buf).toBeInstanceOf(Buffer);
  expect(buf.byteLength).toBeGreaterThan(20_000);
  expect(buf[0]).toBe(0xff);
  expect(buf[1]).toBe(0xd8);
  expect(buf[2]).toBe(0xff);
}

describe("extractHookStat", () => {
  it("promotes source-backed social numbers without recalculating them", () => {
    expect(extractHookStat("21,465 people left NSW last year")).toBe("21,465");
    expect(extractHookStat("Sydney auction clearance hits 74% again")).toBe("74%");
    expect(extractHookStat("$1.66B wiped off Australian asking prices")).toBe("$1.66B");
    expect(extractHookStat("Investor credit rises 8.4% as demand returns")).toBe("8.4%");
  });

  it("does not turn a bare calendar year into the hero claim", () => {
    expect(extractHookStat("2026 housing outlook turns on supply")).toBeNull();
    expect(extractHookStat("2026 auction volumes are 12% higher")).toBe("12%");
  });
});

describe("renderDailyHookCoverCard", () => {
  it("renders the lead hook as a 1080x1350 JPEG", async () => {
    expectJpeg(
      await renderDailyHookCoverCard({
        feedDate: "2026-09-07",
        lead: {
          title: "Investor lending just hit its strongest pace in eighteen months",
          category: "PROPERTY",
          source: "ABS",
          whyItMatters:
            "The change in credit appetite is arriving before the consensus narrative has caught up.",
        },
        supporting: [
          { title: "Auction clearance rates tighten again", category: "PROPERTY" },
          { title: "Banks compete harder on investor pricing", category: "ECONOMY" },
        ],
        metrics: [
          { label: "Cash rate", value: "3.60%" },
          { label: "Investor credit", value: "+8.4%" },
        ],
      })
    );
  });

  it("renders a huge-number hook in both grid variants", async () => {
    const input = {
      feedDate: "2026-09-07",
      lead: {
        title: "$1.66B wiped off Australian asking prices",
        category: "PROPERTY",
        source: "SQM Research",
        whyItMatters: "The repricing is broad enough to matter for spring vendor expectations.",
      },
      supporting: [{ title: "Listings climb into spring", category: "PROPERTY" }],
    } as const;
    expectJpeg(await renderDailyHookCoverCard({ ...input, variant: "navy" }));
    expectJpeg(await renderDailyHookCoverCard({ ...input, variant: "light" }));
  });

  it("survives a sparse day without supporting stories or metrics", async () => {
    expectJpeg(
      await renderDailyHookCoverCard({
        lead: {
          title: "The rate story is moving again",
          category: "ECONOMY",
        },
      })
    );
  });
});
