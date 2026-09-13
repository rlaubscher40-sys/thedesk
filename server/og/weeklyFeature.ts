import type { Edition } from "../db/schema";
import type { EditionTopic } from "../../shared/schemas";
import { briefingDetail, briefingLens, briefingClaimLabel } from "../instagram/briefing";

type Theme = {
  bg: string;
  fg: string;
  fgMuted: string;
  amber: string;
  amberSoft: string;
  bloom: string;
};
type Picture = { src: string; credit: string } | null;
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
const clean = (value: string) => value.replace(/[–—]/g, ", ").replace(/\s+/g, " ").trim();
const heading = (value: string, size: number, c: Theme) =>
  text(value, {
    fontFamily: "Playfair Display",
    fontWeight: 700,
    fontSize: size,
    lineHeight: 1.08,
    letterSpacing: "-0.025em",
    color: c.fg,
  });
const body = (value: string, size: number, c: Theme) =>
  text(value, {
    fontFamily: "Desk Editorial Sans",
    fontSize: size,
    lineHeight: 1.38,
    color: c.fg,
  });
const label = (value: string, c: Theme, size = 23) =>
  text(value, {
    fontFamily: "JetBrains Mono",
    fontSize: size,
    lineHeight: 1.35,
    color: c.amber,
  });

/** Source sentences stay intact. Missing usable detail holds publication. */
export function weeklyTopicContent(topic: EditionTopic) {
  const title = clean(topic.title);
  if (!title || title.length > 200)
    throw new Error("Weekly topic needs editorial review: headline outside layout limit");
  const detail = briefingDetail(topic);
  if (!detail) throw new Error("Weekly topic needs editorial review: missing usable source detail");
  const lens = briefingLens(topic);
  return {
    title,
    detail,
    context: lens.key === "general" ? null : lens.meaning,
    claim: briefingClaimLabel(topic),
    titleSize: title.length <= 55 ? 96 : title.length <= 100 ? 76 : title.length <= 150 ? 62 : 54,
  };
}
export function weeklyFeatureContent(edition: Edition) {
  const lead = edition.topics[0];
  if (!lead?.title.trim()) throw new Error("Weekly feature needs a lead topic");
  const copy = weeklyTopicContent(lead);
  const first = [
    ...new Intl.Segmenter("en-AU", { granularity: "sentence" }).segment(copy.detail),
  ][0]?.segment.trim();
  return {
    ...copy,
    detail: first && /[.!?][”"']?$/.test(first) ? first : copy.detail,
    edition: `Edition ${edition.editionNumber}`,
    period: clean(edition.weekRange?.trim() || edition.weekOf),
    topics: edition.topics.length,
  };
}
function photo(picture: Picture, top: number, height: number, c: Theme) {
  return picture
    ? [
        stack(
          [
            {
              type: "img",
              props: { src: picture.src, width: 936, height, style: { objectFit: "cover" } },
            },
            text(picture.credit, { fontFamily: "JetBrains Mono", fontSize: 17, color: c.fgMuted }),
          ],
          { position: "absolute", top, left: 72, right: 72, gap: 9 }
        ),
      ]
    : [];
}
function canvas(children: object[], c: Theme, vertical: boolean) {
  return stack(children, {
    width: 1080,
    height: vertical ? 1920 : 1350,
    position: "relative",
    backgroundColor: c.bg,
  });
}
function footer(lines: string[], c: Theme, vertical: boolean) {
  return stack(
    lines.map((line, i) => (i === 0 ? body(line, 30, c) : label(line, c, 21))),
    {
      position: "absolute",
      left: 72,
      right: 72,
      bottom: vertical ? 245 : 65,
      gap: 12,
      paddingTop: 22,
      borderTop: `1px solid ${c.fgMuted}`,
    }
  );
}
/** Clean cover, shared by feed and the first Story; no generic advice box. */
export function weeklyFeatureTree(
  edition: Edition,
  c: Theme,
  vertical: boolean,
  logo: string | null,
  picture: Picture = null
) {
  const copy = weeklyFeatureContent(edition);
  const offset = vertical ? 250 : 0;
  const imageTop = offset + (copy.title.length > 100 || copy.detail.length > 240 ? 865 : 735);
  return canvas(
    [
      stack(
        [
          logo
            ? { type: "img", props: { src: logo, width: 226, height: 70 } }
            : label("THE DESK", c, 30),
          label(`PROPERTY THIS WEEK · ${copy.period}`, c, 22),
        ],
        { position: "absolute", top: offset + 62, left: 72, right: 72, gap: 26 }
      ),
      stack(
        [
          heading(copy.title, copy.titleSize, c),
          body(copy.detail, copy.detail.length > 240 ? 30 : 36, c),
          ...(edition.topics[0]?.socialSource
            ? [label(`Source: ${edition.topics[0].socialSource.publisher}`, c, 20)]
            : []),
        ],
        { position: "absolute", top: offset + 245, left: 72, right: 72, gap: 28 },
        imageTop - 28
      ),
      ...photo(picture, imageTop, (vertical ? 1135 : 1085) - (imageTop - offset), c),
      footer(
        [
          vertical
            ? "Your weekly property briefing"
            : `${copy.topics} ${copy.topics === 1 ? "story" : "stories"}. The details behind the headlines.`,
          vertical ? "01 / 03 · Tap for the lead story" : `Swipe to read · ${copy.edition}`,
        ],
        c,
        vertical
      ),
    ],
    c,
    vertical
  );
}
/** Reported detail is the main content. Context is labelled and never uses cached analysis. */
export function weeklyTopicTree(
  topic: EditionTopic,
  slideIndex: number,
  total: number,
  c: Theme,
  vertical = false
) {
  const copy = weeklyTopicContent(topic);
  const offset = vertical ? 270 : 0;
  const source = topic.socialSource;
  const sparse = !copy.context && copy.title.length <= 100 && copy.detail.length <= 260;
  return canvas(
    [
      stack(
        [
          label("THE DESK · PROPERTY", c),
          label(
            `${String(slideIndex + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`,
            c
          ),
        ],
        {
          position: "absolute",
          top: offset + 65,
          left: 72,
          right: 72,
          flexDirection: "row",
          justifyContent: "space-between",
        }
      ),
      stack(
        [
          label(copy.claim, c, 21),
          heading(copy.title, sparse ? copy.titleSize : Math.min(copy.titleSize, 76), c),
          body(copy.detail, sparse ? 44 : copy.detail.length > 320 ? 32 : 37, c),
          ...(copy.context
            ? [
                stack([label("CONTEXT", c, 20), body(copy.context, 29, c)], {
                  gap: 12,
                  borderTop: `1px solid ${c.fgMuted}`,
                  paddingTop: 24,
                }),
              ]
            : []),
        ],
        { position: "absolute", top: offset + (sparse ? 300 : 195), left: 72, right: 72, gap: 28 },
        offset + 1080
      ),
      footer(
        [
          source ? `Source: ${source.publisher}` : "The Desk",
          vertical
            ? "Full briefing on our profile · @thedesk.au"
            : "Sources and publication dates in the caption",
        ],
        c,
        vertical
      ),
    ],
    c,
    vertical
  );
}
/** Final Story previews the other actual stories, with an honest profile CTA. */
export function weeklyRoundupTree(edition: Edition, c: Theme) {
  const others = edition.topics.slice(1, 4).map(weeklyTopicContent);
  const lead = weeklyFeatureContent(edition);
  return canvas(
    [
      stack(
        [
          label("THE DESK · 03 / 03", c),
          heading(others.length ? "Also in your briefing" : "The full picture", 82, c),
          ...others.map((copy, i) =>
            stack(
              [label(`0${i + 2}`, c), heading(copy.title, copy.title.length > 120 ? 40 : 48, c)],
              { gap: 12, paddingTop: 18 }
            )
          ),
          ...(!others.length ? [body(lead.detail, 38, c)] : []),
        ],
        { position: "absolute", top: 285, left: 72, right: 72, gap: 38 },
        1450
      ),
      footer(["Read the carousel on our profile", `@thedesk.au · ${lead.edition}`], c, true),
    ],
    c,
    true
  );
}
