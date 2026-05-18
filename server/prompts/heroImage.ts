/**
 * Hero-image prompt builder. Two flavours:
 *   - `editionHeroPrompt` , the cinematic intelligence-briefing image used on
 *                            the EditionReader hero.
 *   - `substackHeroPrompt`, the Substack essay hero image.
 * Both pick a category-flavoured visual cue so different weeks look different.
 */
import type { EditionTopic } from "../../shared/schemas";

const CATEGORY_VISUAL_CUE: Record<string, string> = {
  MACRO:
    "dark editorial illustration of economic data, interest rate charts, and financial markets, deep navy and amber tones, abstract data visualisation",
  PROPERTY:
    "aerial architectural photography of Australian suburban houses and city skyline, dark moody editorial style, navy and warm gold tones",
  AI: "abstract neural network visualisation with glowing nodes and data streams, dark background, electric blue and amber accents",
  TECH: "abstract technology circuit board and data flow, dark editorial style, blue and amber light",
  POLICY: "government building columns and legal documents, dark editorial photography style, navy and gold",
  GEOPOLITICS:
    "world map with geopolitical tension indicators, dark editorial illustration, navy and red accents",
  SCIENCE: "abstract scientific research imagery, microscopic patterns and data, dark editorial style",
  MARKETS: "stock market data visualisation, trading charts and financial graphs, dark editorial style, amber and green",
  ECONOMICS: "dark editorial illustration of economic indicators and financial markets, navy and amber",
  OTHER: "dark editorial intelligence briefing illustration, abstract data and information flows, navy background with amber accents",
};

function visualCue(category: string | undefined): string {
  const key = (category ?? "OTHER").toUpperCase();
  return CATEGORY_VISUAL_CUE[key] ?? CATEGORY_VISUAL_CUE.OTHER!;
}

export function editionHeroPrompt(args: { weekRange: string; topics: EditionTopic[] }): string {
  const dominant = args.topics[0]?.category;
  const topicTitles = args.topics.slice(0, 2).map((t) => t.title);
  return `Editorial intelligence briefing hero image for a weekly research archive. Week: ${args.weekRange}. Topics: ${topicTitles.join(" and ")}. Style: ${visualCue(dominant)}. No text, no words, no labels. Cinematic, high contrast, dark background.`;
}

export function substackHeroPrompt(args: { title: string; topics: EditionTopic[] }): string {
  const dominant = args.topics[0]?.category;
  return `Substack essay hero image. Topic: ${args.title}. Style: ${visualCue(dominant)}. Wide format, cinematic, high contrast, no text, no words, no labels.`;
}

/**
 * Library-seed prompt. Generates a generic editorial cover that's not
 * tied to a specific edition's content, so the same image can be
 * recycled across many weeks without looking content-mismatched. The
 * `seed` argument rotates the visual cue so a batch of generations
 * doesn't return ten near-identical covers.
 */
const LIBRARY_VISUAL_SEEDS: string[] = [
  CATEGORY_VISUAL_CUE.MACRO!,
  CATEGORY_VISUAL_CUE.PROPERTY!,
  CATEGORY_VISUAL_CUE.MARKETS!,
  CATEGORY_VISUAL_CUE.POLICY!,
  CATEGORY_VISUAL_CUE.ECONOMICS!,
  "dark editorial photograph of an empty newsroom desk at dawn, warm amber lamp light, navy shadows, cinematic depth of field",
  "abstract topographic line drawing of an Australian coastline at night, deep navy with thin amber contour lines, editorial",
  "macro photograph of brass fountain pen and folded newspaper on dark walnut, warm amber rim light, navy background, cinematic",
  "aerial photograph of suburban Australian rooflines at dusk, long shadows, warm amber sky meeting deep navy, editorial documentary style",
  "dark editorial still life of stacked financial reports and a brass desk lamp, amber pool of light, deep navy surroundings, cinematic",
];

export function libraryHeroPrompt(args: { seed?: number } = {}): string {
  const idx =
    typeof args.seed === "number"
      ? ((args.seed % LIBRARY_VISUAL_SEEDS.length) + LIBRARY_VISUAL_SEEDS.length) %
        LIBRARY_VISUAL_SEEDS.length
      : Math.floor(Math.random() * LIBRARY_VISUAL_SEEDS.length);
  const cue = LIBRARY_VISUAL_SEEDS[idx]!;
  return `Editorial intelligence briefing hero image for a weekly Australian property and finance brief. Style: ${cue}. No text, no words, no labels. Cinematic, high contrast, dark background, wide cinematic format.`;
}

/** Image prompt for a single daily-feed item. Used by the background enrichment
 *  step to fill in `dailyFeedItems.imageUrl`. */
export function feedItemImagePrompt(args: {
  title: string;
  summary: string | null;
  category: string;
}): string {
  const summary = args.summary ? `Context: ${args.summary.slice(0, 240)}` : "";
  return `Editorial news thumbnail image for a property and finance intelligence brief. Headline: ${args.title}. ${summary} Style: ${visualCue(args.category)}. Square framing, cinematic, high contrast, no text, no words, no labels.`;
}
