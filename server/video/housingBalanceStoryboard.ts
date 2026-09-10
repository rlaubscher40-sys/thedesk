import { matchedHousingBalance, type HousingBalanceSnapshot } from "../../shared/housingBalance";
import { renderEditorialFrame, loadAsset, type CardVariant } from "../og/instagramCards";
import { HOUSING_DEPOSIT } from "../../shared/housingAffordability";
import { spokenCount } from "./spokenNumbers";
import { assertEditorialStory, type EditorialStory } from "./editorialStory";
import { REEL_READS } from "../instagram/reelCaption";

type Kind =
  | "balance-opening"
  | "balance-households"
  | "balance-comparison"
  | "balance-pressure"
  | "balance-building"
  | "balance-takeaway";
export type HousingBalanceStoryboard = {
  kind: "housing-balance";
  opening: "question" | "consequence";
  evidence: HousingBalanceSnapshot;
  editorial: EditorialStory;
  scenes: Array<{
    key: string;
    text: string;
    kind: Kind;
    phrases: string[];
    motionPhrase?: number;
  }>;
};
export function housingBalanceStoryboard(
  evidence: HousingBalanceSnapshot,
  opening: HousingBalanceStoryboard["opening"] = "question"
): HousingBalanceStoryboard {
  if (!["question", "consequence"].includes(opening))
    throw new Error("Unreviewed housing opening.");
  const b = matchedHousingBalance(evidence);
  if (!b || b.shortfall <= 0) throw new Error("No verified housing supply shortfall.");
  const scene = (key: string, kind: Kind, phrases: string[], motionPhrase?: number) => ({
    key,
    kind,
    text: phrases.join(" "),
    phrases,
    ...(motionPhrase === undefined ? {} : { motionPhrase }),
  });
  const storyboard: HousingBalanceStoryboard = {
    kind: "housing-balance",
    opening,
    evidence: structuredClone(evidence),
    editorial: {
      finding: {
        sceneKeys: ["facts"],
        statement: "Net additions fell short of estimated new housing need by about 55,000 homes.",
        evidence: "NHSAC 2026, p. 21; matched national flows, July 2024 to December 2025.",
      },
      explanation: {
        sceneKeys: ["claim", "construction"],
        statement:
          "Limited supply relative to demand puts upward pressure on prices and rents, while high costs and labour shortages restrict the building response.",
        evidence: "NHSAC 2026, ch. 2, sections 2.1 and 2.3; RBA RDP 2019-01, introduction.",
      },
      consequence: {
        sceneKeys: ["households"],
        statement:
          "The modelled time to save a 20% deposit rose from 9.0 years in 2015 to 11.2 in 2025.",
        evidence:
          "NHSAC 2026, pp. 3, 54, 57; saving 15% of gross median household income annually.",
      },
      takeaway: {
        sceneKeys: ["signOff"],
        statement:
          "Closing the shortage requires completed homes after demolitions to outpace additional housing need; delivery takes time.",
        evidence: "Editorial synthesis of the matched balance and reported supply constraints.",
      },
      limits:
        "A flow gap is not total shortage or a price forecast. Underlying housing need differs from purchasing power. Rates, incomes and local conditions also matter.",
    },
    scenes: [
      scene(
        "label",
        "balance-opening",
        [
          opening === "consequence"
            ? "For buyers, saving a deposit has become a longer climb."
            : "Australia is building homes. Why is buying one getting harder?",
        ],
        0
      ),
      scene(
        "facts",
        "balance-comparison",
        ["Homes added.", "More homes needed.", `A gap of about ${spokenCount(b.shortfall)}.`],
        2
      ),
      scene(
        "claim",
        "balance-pressure",
        ["More competition puts upward pressure on prices and rents."],
        0
      ),
      scene(
        "households",
        "balance-households",
        [
          "For buyers, the estimated deposit-saving time was nine years in twenty fifteen.",
          "By twenty twenty-five, eleven point two years.",
        ],
        1
      ),
      scene(
        "construction",
        "balance-building",
        ["Catching up takes years.", "High costs and labour shortages slow building."],
        1
      ),
      scene(
        "signOff",
        "balance-takeaway",
        [
          "Building more isn't the same as catching up.",
          "Completed homes must outpace new demand to close the gap.",
        ],
        1
      ),
    ],
  };
  assertEditorialStory(
    storyboard.editorial,
    storyboard.scenes.map((s) => s.key)
  );
  return storyboard;
}
export function validateHousingBalanceStoryboard(
  story: HousingBalanceStoryboard,
  script: Array<{ key: string; text: string }>
) {
  assertEditorialStory(
    story.editorial,
    story.scenes.map((s) => s.key)
  );
  const expected = housingBalanceStoryboard(story.evidence, story.opening);
  if (
    JSON.stringify(expected) !== JSON.stringify(story) ||
    JSON.stringify(script) !==
      JSON.stringify(expected.scenes.map(({ key, text }) => ({ key, text })))
  )
    throw new Error("Housing balance pictures and narration do not match the evidence.");
}

/** Deterministic display notation for the verified spoken counts. All other
 * words stay verbatim; the measured audio passage still owns cue timing. */
export function housingBalanceSubtitleScript(
  story: HousingBalanceStoryboard,
  script: Array<{ key: string; text: string }>
) {
  validateHousingBalanceStoryboard(story, script);
  const b = matchedHousingBalance(story.evidence)!;
  const counts: Record<string, number[]> = {
    facts: [b.shortfall],
  };
  return script.map(({ key, text }) => {
    const replacements: Array<[string, string]> = [];
    for (const count of counts[key] ?? []) {
      const spoken = count === 100 ? "hundred" : spokenCount(count);
      if (!text.includes(spoken)) throw new Error("Verified subtitle count is missing.");
      text = text.replace(spoken, count.toLocaleString("en-AU"));
      replacements.push([spoken, count.toLocaleString("en-AU")]);
    }
    if (key === "households") {
      for (const [spoken, digits] of [
        ["twenty per cent", "20%"],
        ["nine years", "9 years"],
        ["twenty fifteen", "2015"],
        ["twenty twenty-five", "2025"],
        ["eleven point two", "11.2"],
      ]) {
        text = text.replace(spoken!, digits!);
        replacements.push([spoken!, digits!]);
      }
    }
    const phrases = story.scenes
      .find((s) => s.key === key)!
      .phrases.map((phrase) =>
        replacements.reduce((value, [spoken, digits]) => value.replace(spoken, digits), phrase)
      );
    return { key, text, phrases };
  });
}
type Node = { type: string; props: Record<string, unknown> };
/** One eased, rounded value drives both the label and its bar. Intermediate
 * frames are animation, not additional observations or spurious precision. */
export function balanceCountFrame(target: number, progress: number, scale = 300000) {
  if (
    !Number.isSafeInteger(target) ||
    target < 0 ||
    !Number.isFinite(progress) ||
    progress < 0 ||
    progress > 1 ||
    scale <= 0
  )
    throw new Error("Invalid count-up frame");
  const eased = 1 - Math.pow(1 - progress, 3);
  const value =
    progress === 1 ? target : Math.min(target, Math.round((target * eased) / 1000) * 1000);
  return { value, widthPercent: (value / scale) * 100 };
}
const box = (style: Record<string, unknown>, children: unknown): Node => ({
  type: "div",
  props: { style: { display: "flex", ...style }, children },
});
const text = (value: string, size: number, color: string, serif = false): Node =>
  box(
    {
      fontFamily: serif ? "Playfair Display" : "Desk Editorial Sans",
      fontSize: size,
      fontWeight: serif ? 700 : 400,
      color,
      lineHeight: 1.15,
    },
    value
  );
const italic = (value: string, size: number, color: string): Node =>
  box(
    {
      fontFamily: "Desk Editorial Italic",
      fontStyle: "italic",
      fontWeight: 500,
      fontSize: size,
      color,
      lineHeight: 1.18,
    },
    value
  );

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => 1 - Math.pow(1 - clamp(v), 3);
const at = (left: number, top: number, children: unknown, extra: Record<string, unknown> = {}) =>
  box({ position: "absolute", left, top, ...extra }, children);

/** The developing comparison keeps one zero baseline and scale. */
export const BALANCE_CHART = {
  width: 840,
  scale: 300000,
  supplyTop: 300,
  demandTop: 535,
  barTop: 148,
};
export function housingBalanceGeometry(
  story: HousingBalanceStoryboard,
  key: string,
  progress: number
) {
  const b = matchedHousingBalance(story.evidence);
  if (!b || !Number.isFinite(progress) || progress < 0 || progress > 1)
    throw new Error("Invalid balance geometry");
  const staged = key === "facts";
  const supply = staged ? balanceCountFrame(b.net, clamp(progress * 3)).value : b.net;
  const demand = staged ? balanceCountFrame(b.demand, clamp(progress * 3 - 1)).value : b.demand;
  const gap = staged ? balanceCountFrame(b.shortfall, clamp(progress * 3 - 2)).value : b.shortfall;

  return {
    supply,
    demand,
    gap,
    supplyWidth: (supply / BALANCE_CHART.scale) * BALANCE_CHART.width,
    demandWidth: (demand / BALANCE_CHART.scale) * BALANCE_CHART.width,
    gapLeft: (b.net / BALANCE_CHART.scale) * BALANCE_CHART.width,
    gapWidth: (gap / BALANCE_CHART.scale) * BALANCE_CHART.width,
  };
}

function svgNode(body: string, width: number, height: number): Node {
  return {
    type: "img",
    props: {
      width,
      height,
      src: `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`).toString("base64")}`,
    },
  };
}

/** Preserve the measured uncovered segment before introducing price pressure.
 * The deposit ruler is separate context and never shares the housing-count scale. */
export function housingStoryBridge(stage: "gap" | "competition" | "deposit", progress: number) {
  const p = ease(stage === "deposit" ? progress * 2 : progress);
  const gap = { x: 649.6, y: 683, width: 154, height: 22 };
  const pressure = { x: 649.6, y: 300, width: 154, height: 22 };
  const ruler = { x: 630, y: 690, width: 154, height: 3 };
  // These are different units and periods. Retire the housing marker in place
  // before revealing the time extension; never sweep it through the year label.
  if (stage === "deposit")
    return progress <= 0.5
      ? { ...pressure, width: pressure.width * (1 - p) }
      : { ...ruler, width: ruler.width * ease(progress * 2 - 1) };
  const a = gap;
  const b = stage === "competition" ? pressure : gap;
  return {
    x: a.x + (b.x - a.x) * p,
    y: a.y + (b.y - a.y) * p,
    width: a.width + (b.width - a.width) * p,
    height: a.height + (b.height - a.height) * p,
  };
}

export function housingBalanceFrameLayout(
  story: HousingBalanceStoryboard,
  key: string,
  progress: number,
  variant: CardVariant,
  photo?: string
) {
  const b = matchedHousingBalance(story.evidence),
    scene = story.scenes.find((s) => s.key === key);
  if (!b || !scene || !Number.isFinite(progress) || progress < 0 || progress > 1)
    throw new Error("Invalid housing balance frame.");
  const c =
    variant === "light"
      ? { fg: "#171B21", muted: "#66635C", gold: "#946C29", rule: "#CEC7BA", track: "#E6E0D4" }
      : { fg: "#F0EDE6", muted: "#A4A29C", gold: "#C5A267", rule: "#464A4D", track: "#20262C" };
  const n = (v: number) => v.toLocaleString("en-AU");
  const tag = (v: string) =>
    box({ fontFamily: "JetBrains Mono", fontSize: 23, color: c.muted, letterSpacing: 1.5 }, v);
  const marker = (m: ReturnType<typeof housingStoryBridge>) =>
    at(m.x, m.y, "", { width: m.width, height: m.height, backgroundColor: c.gold });
  const archive = (top: number, height: number, p: number) =>
    at(
      0,
      top,
      box({ width: 840, height, overflow: "hidden", position: "relative" }, [
        ...(photo
          ? [
              {
                type: "img",
                props: {
                  src: photo,
                  width: key === "label" ? 1040 : 840,
                  height: key === "label" ? 732.46 : 1260,
                  style: {
                    position: "absolute",
                    left: key === "label" ? -180 : 0,
                    top: (key === "label" ? -60 : -300) - 18 * ease(p),
                    objectFit: "cover",
                  },
                },
              },
            ]
          : []),
        at(0, 0, "", { width: 840, height, backgroundColor: "rgba(9,16,24,0.15)" }),
      ])
    );
  const comparison = (p: number) => {
    const g = housingBalanceGeometry(story, "facts", p);
    const row = (need: boolean) =>
      at(
        0,
        need ? 535 : 300,
        [
          at(0, 59, text(need ? "Extra homes needed" : "Net homes added", 35, c.muted)),
          at(0, 0, text(n(need ? g.demand : g.supply), 105, c.fg, true), {
            width: 840,
            justifyContent: "flex-end",
          }),
          at(0, 148, "", { width: 840, height: 22, backgroundColor: c.track }),
          at(0, 148, "", {
            width: need ? g.demandWidth : g.supplyWidth,
            height: 22,
            backgroundColor: need ? c.fg : c.gold,
          }),
        ],
        { width: 840, height: 185, opacity: need ? clamp(p * 3 - 1) : 1 }
      );
    return [
      at(0, 0, text("Building.", 96, c.fg, true)),
      at(0, 117, italic("Falling behind.", 97, c.gold)),
      row(false),
      row(true),
      at(g.gapLeft, 683, "", { width: g.gapWidth, height: 22, backgroundColor: c.gold }),
      at(
        0,
        795,
        box({ gap: 20, alignItems: "baseline", opacity: clamp(p * 3 - 2) }, [
          text(n(g.gap), 87, c.gold, true),
          text("more homes needed", 36, c.fg),
        ])
      ),
      at(0, 925, tag("NET OF DEMOLITIONS / SAME 18 MONTHS")),
    ];
  };
  const competition = (p: number) => {
    const bridge = housingStoryBridge("competition", clamp(p * 3));
    const reveal = ease((p - 0.23) / 0.6);
    const g = housingBalanceGeometry(story, "facts", 1);
    return [
      at(0, 0, tag("WHAT THE SHORTFALL MEANS")),
      at(0, 75, text("The squeeze.", 132, c.fg, true)),
      at(0, bridge.y, "", { width: g.supplyWidth, height: 22, backgroundColor: c.rule }),
      marker(bridge),
      at(0, 240, text("Homes added", 34, c.muted), { opacity: reveal }),
      at(630, 240, text("Unmet need", 32, c.gold), { opacity: reveal }),
      at(
        0,
        330,
        svgNode(
          `<path d="M727 0V64H24V108" fill="none" stroke="${c.gold}" stroke-width="2" opacity="${reveal}"/>`,
          840,
          110
        )
      ),
      at(0, 450, text("More", 119, c.fg, true), { opacity: reveal }),
      at(0, 570, italic("competition.", 119, c.gold), { opacity: reveal }),
      at(
        0,
        750,
        box({ gap: 60, opacity: reveal }, [
          box({ gap: 12, alignItems: "baseline" }, [
            text("↑", 58, c.gold),
            text("Prices", 58, c.gold, true),
          ]),
          box({ gap: 12, alignItems: "baseline" }, [
            text("↑", 58, c.gold),
            text("Rents", 58, c.gold, true),
          ]),
        ])
      ),
      at(0, 850, text("Pressure, not guaranteed price rises.", 36, c.fg)),
      at(0, 920, tag("RATES AND INCOMES ALSO MATTER")),
    ];
  };
  let nodes: unknown[];
  if (key === "label")
    nodes = [
      at(
        0,
        0,
        text(story.opening === "consequence" ? "The deposit." : "More homes.", 102, c.fg, true)
      ),
      at(
        0,
        125,
        italic(story.opening === "consequence" ? "A longer climb." : "Harder to buy?", 98, c.gold)
      ),
      archive(310, 510, progress),
      at(0, 855, tag("ARCHITECTURE / ILLUSTRATIVE PHOTO")),
      at(0, 905, text("Phillip Flores / Unsplash", 28, c.muted)),
    ];
  else if (key === "facts") nodes = comparison(progress);
  else if (key === "claim") {
    nodes = competition(progress);
  } else if (key === "households") {
    const p = ease(clamp(progress * 2 - 1));
    const later = progress >= 0.5;
    const shown =
      HOUSING_DEPOSIT.startYears + (HOUSING_DEPOSIT.endYears - HOUSING_DEPOSIT.startYears) * p;
    const m = housingStoryBridge("deposit", progress);
    nodes = [
      at(
        0,
        0,
        [
          at(0, 0, text("The deposit", 98, c.fg, true)),
          at(0, 118, italic("moved further away.", 76, c.gold)),
          ...(later
            ? [at(0, 310, text("2015", 29, c.muted)), at(0, 365, text("9.0", 83, c.muted, true))]
            : []),
          at(330, 310, text(later ? "2025" : "2015", 29, c.gold)),
          at(
            320,
            340,
            box({ alignItems: "baseline", gap: 15 }, [
              text(shown.toFixed(1), 166, c.fg, true),
              italic("years", 54, c.gold),
            ])
          ),
          at(0, 550, text("To save a modelled 20% deposit", 42, c.fg)),
          at(
            0,
            640,
            svgNode(
              `<path d="M0 50H840" stroke="${c.rule}"/>${Array.from({ length: 13 }, (_, i) => `<path d="M${i * 70} 37V63" stroke="${c.muted}"/>`).join("")}<path d="M0 50H630" stroke="${c.muted}" stroke-width="3"/>`,
              840,
              90
            )
          ),
          marker(m),
          at(0, 750, text("Saving 15% of gross median household income", 31, c.muted)),
          at(0, 802, text("each year. Median-priced dwelling.", 31, c.muted)),
          at(0, 880, tag("SEPARATE DECADE / NOT AN OBSERVED WAIT")),
        ],
        { width: 840, height: 980 }
      ),
    ];
  } else if (key === "construction") {
    const p = ease(progress * 2 - 1);
    nodes = [
      at(0, 0, text("Catching up", 97, c.fg, true)),
      at(0, 115, italic("takes years.", 104, c.gold)),
      archive(300, 420, progress),
      at(0, 749, tag("SYDNEY / ARCHIVE PUBLISHED 2019 / DAMON HALL")),
      at(0, 810, text("High costs. Shortages of skilled labour.", 40, c.fg), { opacity: p }),
      at(0, 910, tag("ILLUSTRATIVE ARCHIVE / UNSPLASH")),
    ];
  } else {
    const p = ease(progress * 2 - 1),
      width = 470 + 290 * p;
    nodes = [
      at(0, 0, text("More homes.", 102, c.fg, true)),
      at(0, 116, italic("Enough to catch up.", 83, c.gold)),
      at(0, 355, text("Homes added", 39, c.gold)),
      at(0, 420, "", { width, height: 22, backgroundColor: c.gold }),
      at(0, 535, text("Extra homes needed", 39, c.fg)),
      at(0, 600, "", { width: 640, height: 22, backgroundColor: c.fg }),
      at(640, 398, "", { height: 245, borderLeft: `1px solid ${c.muted}` }),
      at(0, 725, text("Add homes faster than need grows.", 43, c.fg)),
      at(0, 800, tag("NET ADDITIONS / ILLUSTRATION / NO FORECAST")),
      at(0, 900, text(`Link in bio / ${REEL_READS.housingBalance.label}`, 28, c.gold)),
    ];
  }
  return {
    content: box({ width: 840, height: 980, position: "relative" }, nodes),
    meta: {
      kicker:
        key === "facts"
          ? "AUSTRALIA / JUL 2024 TO DEC 2025"
          : key === "households"
            ? "AUSTRALIA / 2015 TO 2025"
            : key === "label"
              ? "AUSTRALIA / HOUSING AFFORDABILITY"
              : "HOUSING AFFORDABILITY / THE EXPLANATION",
      source:
        key === "households" || (key === "label" && story.opening === "consequence")
          ? "NHSAC 2026 / pp. 3, 54, 57 / Modelled deposit"
          : key === "facts"
            ? "NHSAC 2026 / p. 21 / Approximate figures"
            : key === "claim"
              ? "NHSAC 2026 / ch. 2 / RBA RDP 2019-01"
              : "NHSAC 2026 / ch. 2 / Housing supply",
      publisher: "National Housing Supply and Affordability Council",
      index: story.scenes.indexOf(scene),
      count: story.scenes.length,
      quiet: true,
      documentary: true,
    },
  };
}
export async function renderHousingBalanceFrame(
  story: HousingBalanceStoryboard,
  key: string,
  progress: number,
  variant: CardVariant
) {
  const photo = await loadAsset(
    key === "label" ? "architecture-phillip-flores.jpg" : "sydney-construction-damon-hall.jpg"
  );
  if (!photo) throw new Error("Reviewed archive photograph is missing.");
  const { content, meta } = housingBalanceFrameLayout(story, key, progress, variant, photo);
  return renderEditorialFrame(content, variant, meta);
}
