import { it, expect } from "vitest";
import sharp from "sharp";
import { buildBriefingSlides } from "../instagram/briefing";
import { renderBriefingSlide } from "./briefingCards";
import type { DailyFeedItem } from "../db/schema";
it("renders the full six-slide briefing and Story in the actual publishing formats", async () => {
  const story = {
    id: 1,
    title: "Australian housing approvals and mortgage stress overlap",
    summary:
      "The Australian report compares building approvals with mortgage stress across different council areas.",
    source: "Design fixture",
    feedDate: "2026-09-12",
  } as DailyFeedItem;
  const slides = buildBriefingSlides([story, { ...story, id: 2 }, { ...story, id: 3 }]);
  for (const variant of ["navy", "light"] as const)
    for (const [i, slide] of slides.entries()) {
      const bytes = await renderBriefingSlide(slide, i, slides.length, variant);
      expect(await sharp(bytes).metadata()).toMatchObject({
        format: "jpeg",
        width: 1080,
        height: 1350,
      });
    }
  expect(
    await sharp(await renderBriefingSlide(slides[1]!, 0, 1, "light", true)).metadata()
  ).toMatchObject({ width: 1080, height: 1920 });
}, 30000);

it("fits long source claims without truncating them or overlapping the next region", async () => {
  const story = {
    id: 9,
    title:
      "Australian dwelling approvals increased across the latest reporting period while construction starts and completed homes remained separate measures in the report",
    summary:
      "The report compares Australian dwelling approvals across several locations and reporting periods. It distinguishes permission to build from construction work beginning on site and from building work reaching completion. The figures cover different stages of housing supply and should be read with the relevant period, property type and geographical coverage alongside each measure.",
    source: "Australian source publication with a longer name",
    feedDate: "2026-09-12",
  } as DailyFeedItem;
  const slides = buildBriefingSlides([story, { ...story, id: 10 }]);
  for (const i of [0, 1, 3]) {
    expect(
      (await renderBriefingSlide(slides[i]!, i, slides.length, "light")).byteLength
    ).toBeGreaterThan(10000);
  }
}, 30000);
