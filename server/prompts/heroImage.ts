/**
 * Hero-image prompt builder. Two flavours:
 *   - `editionHeroPrompt`  — the cinematic intelligence-briefing image used on
 *                            the EditionReader hero.
 *   - `substackHeroPrompt` — the Substack essay hero image.
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
