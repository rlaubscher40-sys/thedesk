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

/**
 * Library-seed prompt. Generates a generic editorial cover that's not
 * tied to a specific edition's content, so the same image can be
 * recycled across many weeks without looking content-mismatched.
 *
 * Earlier seeds leaned heavily on "Australian" + "data" + "amber"
 * which collapsed GPT to outline-of-Australia variants on most rolls.
 * These are broader: photography, architecture, materials, light
 * studies, abstract shapes — each seed is a distinct subject so a
 * batch of generations returns visually different covers.
 *
 * Constraints (applied to every prompt below):
 *   · NO maps of Australia, NO continent outlines
 *   · NO charts, NO graphs, NO data visualisations as the focal point
 *   · NO text, NO words, NO labels, NO logos
 *   · Wide cinematic format (~3:2)
 */
const LIBRARY_VISUAL_SEEDS: string[] = [
  // ── Editorial still life ─────────────────────────────────────────
  "macro photograph of a brass fountain pen resting on folded broadsheet newspaper, dark walnut desk, single warm side-light, deep shadow, shallow depth of field",
  "still life of a vintage brass desk lamp casting a pool of warm light over a leather-bound notebook on dark wood, the rest of the frame in deep shadow",
  "overhead photograph of an open paperback book spread across a dark linen surface, single shaft of dawn light cutting across the pages, fine paper texture",
  "close-up of a cup of black coffee on a dark slate desk beside a folded newspaper, steam rising, warm rim light from a window out of frame",
  "macro of a brass key resting on aged parchment, dark velvet background, golden hour light, museum catalogue aesthetic",

  // ── Architecture and interiors ──────────────────────────────────
  "low-angle photograph of tall stone columns of a neoclassical institutional building at dusk, warm sodium light glancing off the stone, deep navy sky",
  "interior of a moody private library at night, leather chair in the foreground, walls of dark wood bookshelves, single brass reading lamp, warm and shadowed",
  "long corridor of a modernist building at twilight, polished concrete floor, single window casting a slanted bar of warm light across the frame",
  "cinematic photograph of a darkened boardroom after hours, empty leather chairs, single ceiling fixture lit, brass details, deep navy palette",

  // ── Texture and material studies ────────────────────────────────
  "extreme close-up of crumpled black silk fabric with subtle bronze highlights catching a single light source, abstract texture, no recognisable subject",
  "macro photograph of dark marble veined with copper, soft directional lighting, abstract surface study, no horizon line",
  "stack of weathered manila folders on a dark surface, side light revealing paper grain, deep editorial mood, no visible text",
  "tight crop of cracked terracotta roof tiles at dusk, warm orange tones, deep shadows in the gaps, abstract pattern study",

  // ── Light, abstraction, and weather ─────────────────────────────
  "long-exposure photograph of city light trails reflected in wet asphalt at night, abstract amber streaks against a deep navy black, no buildings visible",
  "abstract photograph of warm light filtering through narrow window blinds onto a dark surface, alternating bands of amber and shadow, no subject",
  "thunderstorm cloud over a dark ocean at dusk, single shaft of amber sunset breaking through, wide cinematic atmospheric photograph",
  "macro of swirling smoke in a single warm spotlight against a black background, abstract organic shapes, fine particulate detail",

  // ── Cinematic objects ───────────────────────────────────────────
  "antique brass pocket watch lying face-down on a dark leather surface, soft warm side-light, deep navy shadow, museum-quality detail",
  "close-up of a vintage rotary telephone in deep shadow with a single warm light striking the brass dial, editorial mood",
  "darkened wooden ship's compass on weathered chart paper, warm tungsten light pooling on the brass casing, navy shadow",
];

export function libraryHeroPrompt(args: { seed?: number } = {}): string {
  const idx =
    typeof args.seed === "number"
      ? ((args.seed % LIBRARY_VISUAL_SEEDS.length) + LIBRARY_VISUAL_SEEDS.length) %
        LIBRARY_VISUAL_SEEDS.length
      : Math.floor(Math.random() * LIBRARY_VISUAL_SEEDS.length);
  const subject = LIBRARY_VISUAL_SEEDS[idx]!;
  return [
    "Cover image for a weekly editorial brief on property, finance and partnerships. Subject:",
    subject + ".",
    "Visual register: cinematic, high contrast, deep navy and warm amber palette, photographic realism (or photo-real illustration when the subject is abstract).",
    "STRICT CONSTRAINTS: do NOT include any maps, country outlines, continents, world globes, charts, graphs, data visualisations, candlestick patterns, currency symbols, houses, skylines, or financial iconography. Do NOT include text, words, letters, numbers, labels, or logos. Treat this as a magazine cover plate, not an infographic.",
    "Composition: wide cinematic format (3:2), single dominant subject, deep negative space, room for an editorial overlay at the bottom-left.",
  ].join(" ");
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
