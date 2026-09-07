import { describe, expect, it } from "vitest";
import { renderDailyHookCoverCard } from "./dailyHookCover";

function expectJpeg(buf: Buffer) {
  expect(buf).toBeInstanceOf(Buffer);
  expect(buf.byteLength).toBeGreaterThan(20_000);
  expect(buf[0]).toBe(0xff);
  expect(buf[1]).toBe(0xd8);
  expect(buf[2]).toBe(0xff);
}

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
