import type { DailyFeedItem } from "../db/schema";
import { buildBriefingSlides } from "./briefing";
import { renderBriefingSlide } from "../og/briefingCards";

/** The lead gets the cover; secondary stories and unrelated metrics do not. */
export function renderPropertyDailyCover(
  stories: DailyFeedItem[],
  variant: "navy" | "light",
  _metrics?: Array<{ label: string; value: string }>
): Promise<Buffer> {
  const slides = buildBriefingSlides(stories);
  return renderBriefingSlide(slides[0]!, 0, slides.length, variant);
}
