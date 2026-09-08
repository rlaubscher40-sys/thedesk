import type { Edition } from "../db/schema";
import { propertyReadingQuestion } from "../instagram/sourceContent";

type Theme = {
  bg: string;
  fg: string;
  fgMuted: string;
  amber: string;
  amberSoft: string;
  bloom: string;
};
const text = (children: string, style: Record<string, unknown> = {}) => ({
  type: "div",
  props: { style: { display: "flex", ...style }, children },
});
const stack = (children: object[], style: Record<string, unknown> = {}, maxBottom?: number) => ({
  type: "div",
  props: {
    style: { display: "flex", flexDirection: "column", ...style },
    children,
    "data-max-bottom": maxBottom,
  },
});

/** Preserve the whole lead claim. Do not shorten away its geography or period. */
export function weeklyFeatureContent(edition: Edition) {
  const lead = edition.topics[0];
  if (!lead?.title.trim()) throw new Error("Weekly feature needs a lead topic");
  if (lead.title.length > 200)
    throw new Error("Weekly lead needs editorial review: headline exceeds layout limit");
  const title = lead.title.trim();
  return {
    title,
    question: propertyReadingQuestion(lead),
    edition: `Edition ${edition.editionNumber}`,
    period: edition.weekRange?.trim() || edition.weekOf,
    topics: edition.topics.length,
    titleSize: title.length <= 55 ? 100 : title.length <= 100 ? 82 : title.length <= 150 ? 68 : 58,
  };
}

/** Keep the lead central; the renderer checks the actual body/footer clearance. */
export function weeklyFeatureTree(
  edition: Edition,
  c: Theme,
  vertical: boolean,
  logo: string | null
) {
  const copy = weeklyFeatureContent(edition);
  const height = vertical ? 1920 : 1350;
  const coreTop = vertical ? 480 : 225;
  return stack(
    [
      stack(
        [
          logo
            ? { type: "img", props: { src: logo, width: 226, height: 70 } }
            : text("THE DESK", { fontFamily: "JetBrains Mono", fontSize: 34, color: c.amber }),
          text("WEEKLY PROPERTY BRIEF", {
            fontFamily: "JetBrains Mono",
            fontSize: 26,
            color: c.amber,
            letterSpacing: "0.08em",
          }),
        ],
        { position: "absolute", top: vertical ? 220 : 65, left: 72, right: 72, gap: 24 }
      ),
      stack(
        [
          text("THE WEEK'S LEAD", {
            fontFamily: "JetBrains Mono",
            fontSize: 28,
            color: c.amber,
            letterSpacing: "0.06em",
          }),
          text(copy.title, {
            fontFamily: "Playfair Display",
            fontWeight: 700,
            fontSize: copy.titleSize,
            lineHeight: 1.06,
            letterSpacing: "-0.025em",
            color: c.fg,
          }),
          stack(
            [
              text("BEFORE YOU ACT", {
                fontFamily: "JetBrains Mono",
                fontSize: 26,
                color: c.amber,
                letterSpacing: "0.05em",
              }),
              text(copy.question, {
                fontFamily: "Playfair Display",
                fontWeight: 700,
                fontSize: 34,
                lineHeight: 1.35,
                color: c.fg,
              }),
            ],
            {
              gap: 18,
              padding: "26px 28px",
              backgroundColor: c.amberSoft,
              borderLeft: `3px solid ${c.amber}`,
            }
          ),
          text(
            `${copy.edition} · ${copy.topics} ${copy.topics === 1 ? "property story" : "property stories"}`,
            {
              fontFamily: "JetBrains Mono",
              fontSize: 26,
              lineHeight: 1.4,
              color: c.fgMuted,
            }
          ),
          text(`Edition week: ${copy.period}`, {
            fontFamily: "JetBrains Mono",
            fontSize: 26,
            lineHeight: 1.4,
            color: c.fgMuted,
          }),
        ],
        { position: "absolute", top: coreTop, left: 72, right: 72, gap: 26 },
        vertical ? 1480 : 1100
      ),
      stack(
        [
          text(vertical ? "Read the full briefing" : "Swipe for the property stories", {
            fontFamily: "Playfair Display",
            fontWeight: 700,
            fontSize: 40,
            color: c.fg,
          }),
          text(`thedesk.au / Editions / ${edition.editionNumber}`, {
            fontFamily: "JetBrains Mono",
            fontSize: 26,
            color: c.amber,
          }),
        ],
        {
          position: "absolute",
          bottom: vertical ? 245 : 75,
          left: 72,
          right: 72,
          gap: 20,
          borderTop: `1px solid ${c.fgMuted}`,
          paddingTop: 28,
        }
      ),
    ],
    { width: 1080, height, position: "relative", backgroundColor: c.bg, backgroundImage: c.bloom }
  );
}
