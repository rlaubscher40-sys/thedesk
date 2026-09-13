import { matchedHousingBalance, type HousingBalanceSnapshot } from "../../shared/housingBalance";
import { renderEditorialFrame, loadAsset, type CardVariant } from "../og/instagramCards";
import { HOUSING_DEPOSIT } from "../../shared/housingAffordability";
import { spokenCount } from "./spokenNumbers";
import { assertEditorialStory, type EditorialStory } from "./editorialStory";
import { REEL_READS } from "../instagram/reelCaption";
import { moving, smooth } from "./reelMotion";
import { housingOpening } from "./reelOpening";
import { REEL_SHOTS, reelSceneShot } from "./reelVisualStandard";

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
      scene("label", "balance-opening", [housingOpening(b.shortfall, opening).voice], 0),
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
/** One eased value drives the bar and its rounded label. Intermediate
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
  const eased = smooth(progress);
  const value =
    progress === 1 ? target : Math.min(target, Math.round((target * eased) / 1000) * 1000);
  return { value, widthPercent: ((target * eased) / scale) * 100 };
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
const ease = smooth;
const at = (left: number, top: number, children: unknown, extra: Record<string, unknown> = {}) =>
  box({ position: "absolute", left, top, ...extra }, children);

/** The developing comparison keeps one zero baseline and scale. */
export const BALANCE_CHART = {
  width: 840,
  scale: 300000,
  supplyTop: 250,
  demandTop: 510,
  barTop: 212,
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
    supplyWidth:
      ((b.net * (staged ? ease(progress * 3) : 1)) / BALANCE_CHART.scale) * BALANCE_CHART.width,
    demandWidth:
      ((b.demand * (staged ? ease(progress * 3 - 1) : 1)) / BALANCE_CHART.scale) *
      BALANCE_CHART.width,
    gapLeft: (b.net / BALANCE_CHART.scale) * BALANCE_CHART.width,
    gapWidth:
      ((b.shortfall * (staged ? ease(progress * 3 - 2) : 1)) / BALANCE_CHART.scale) *
      BALANCE_CHART.width,
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
export function housingStoryBridge(stage: "gap" | "competition", progress: number) {
  const p = ease(progress);
  const gap = {
    x: 649.6,
    y: BALANCE_CHART.demandTop + BALANCE_CHART.barTop,
    width: 154,
    height: 22,
  };
  const pressure = { x: 649.6, y: 300, width: 154, height: 22 };
  const a = gap;
  const b = stage === "competition" ? pressure : gap;
  return {
    x: a.x + (b.x - a.x) * p,
    y: a.y + (b.y - a.y) * p,
    width: a.width + (b.width - a.width) * p,
    height: a.height + (b.height - a.height) * p,
  };
}

/** The marker moves continuously; its label rounds to one decimal. Frames are
 * animation between the two observations, never annual deposit estimates. */
export function housingDepositGeometry(progress: number) {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1)
    throw new Error("Invalid deposit progress.");
  const p = ease(clamp(progress * 2 - 1));
  const start = HOUSING_DEPOSIT.startYears,
    end = HOUSING_DEPOSIT.endYears;
  const years = Math.round((start + (end - start) * p) * 10) / 10;
  return { later: progress >= 0.5, years, dotX: 90 + p * 660 };
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
  const openingLine = (value: string, size: number, slanted = false) => {
    const node = slanted ? italic(value, size, c.gold) : text(value, size, c.fg, true);
    return {
      ...node,
      props: {
        ...node.props,
        style: { ...(node.props.style as Record<string, unknown>), width: 840 },
        "data-reel-safe-text": true,
        "data-reel-max-height": 210,
      },
    };
  };
  const marker = (m: ReturnType<typeof housingStoryBridge>) =>
    at(m.x, m.y, "", { width: m.width, height: m.height, backgroundColor: c.gold });
  const shot = reelSceneShot("housing-balance", key);
  const photographic = shot !== null;
  const camera = key === "signOff" ? 1 + progress * 0.15 : progress;
  const zoom = 1 + 0.025 * camera;
  const photoHeight = 1980 * zoom;
  const photoWidth = 1080 * zoom;
  const background =
    photographic && photo
      ? box(
          { position: "absolute", left: 0, top: 0, width: 1080, height: 1920, overflow: "hidden" },
          [
            {
              type: "img",
              props: {
                src: photo,
                width: photoWidth,
                height: photoHeight,
                style: {
                  position: "absolute",
                  left: (1080 - photoWidth) / 2,
                  top: -35 - camera * 28,
                  objectFit: "cover",
                },
              },
            },
            at(0, 0, "", {
              width: 1080,
              height: 1920,
              backgroundImage:
                key === "signOff"
                  ? "linear-gradient(180deg, rgba(12,17,23,0.84) 0%, rgba(12,17,23,0.92) 100%)"
                  : "linear-gradient(180deg, rgba(12,17,23,0.60) 0%, rgba(12,17,23,0.15) 28%, rgba(12,17,23,0.65) 50%, rgba(12,17,23,0.96) 76%, rgba(12,17,23,0.98) 100%)",
            }),
          ]
        )
      : undefined;
  const comparison = (p: number) => {
    const g = housingBalanceGeometry(story, "facts", p);
    const row = (need: boolean) =>
      at(
        0,
        need ? BALANCE_CHART.demandTop : BALANCE_CHART.supplyTop,
        [
          moving(
            `${need ? "demand" : "supply"}-label`,
            at(0, 0, text(need ? "Extra homes needed" : "Net homes added", 38, c.muted)),
            840,
            50
          ),
          moving(
            `${need ? "demand" : "supply"}-value`,
            at(0, 45, text(n(need ? g.demand : g.supply), 134, c.fg, true), {
              width: 840,
              justifyContent: "flex-end",
            })
          ),
          moving(
            `${need ? "demand" : "supply"}-track`,
            at(0, BALANCE_CHART.barTop, "", { width: 840, height: 22, backgroundColor: c.track }),
            840,
            22,
            "rect"
          ),
          moving(
            `${need ? "demand" : "supply"}-fill`,
            at(0, BALANCE_CHART.barTop, "", {
              width: need ? g.demandWidth : g.supplyWidth,
              height: 22,
              backgroundColor: need ? c.fg : c.gold,
            }),
            840,
            22,
            "rect"
          ),
        ],
        { width: 840, height: 240, opacity: need ? clamp(p * 3 - 1) : 1 }
      );
    return [
      at(0, 0, text("Building.", 96, c.fg, true)),
      at(0, 117, italic("Falling behind.", 97, c.gold)),
      row(false),
      row(true),
      moving(
        "gap-fill",
        at(g.gapLeft, BALANCE_CHART.demandTop + BALANCE_CHART.barTop, "", {
          width: g.gapWidth,
          height: 22,
          backgroundColor: c.gold,
        }),
        840,
        22,
        "rect"
      ),
      moving(
        "gap-caption",
        at(
          0,
          775,
          box({ gap: 20, alignItems: "baseline" }, [
            text(n(g.gap), 84, c.gold, true),
            text("more homes needed", 36, c.fg),
          ]),
          { opacity: ease(p * 3 - 2) }
        )
      ),
      at(0, 895, tag("NET OF DEMOLITIONS / SAME 18 MONTHS")),
    ];
  };
  const competition = (p: number) => {
    const bridge = housingStoryBridge("competition", clamp(p * 3));
    const reveal = ease((p - 0.23) / 0.6);
    const g = housingBalanceGeometry(story, "facts", 1);
    return [
      at(0, 0, tag("WHAT THE SHORTFALL MEANS")),
      at(0, 75, text("The squeeze.", 132, c.fg, true)),
      moving(
        "supply-bridge",
        at(0, bridge.y, "", { width: g.supplyWidth, height: 22, backgroundColor: c.rule }),
        840,
        22,
        "rect"
      ),
      moving("gap-bridge", marker(bridge), 840, 22, "rect"),
      moving(
        "supply-label",
        at(0, 240, text("Homes added", 34, c.muted), { opacity: reveal }),
        300,
        50
      ),
      moving(
        "need-label",
        at(630, 240, text("Unmet need", 32, c.gold), { opacity: reveal }),
        210,
        50
      ),
      moving(
        "connector",
        at(
          0,
          330,
          svgNode(
            `<path d="M727 0V64H24V108" fill="none" stroke="${c.gold}" stroke-width="2"/>`,
            840,
            110
          ),
          { opacity: reveal }
        ),
        840,
        110
      ),
      moving("more", at(0, 450, text("More", 119, c.fg, true), { opacity: reveal })),
      moving("competition", at(0, 570, italic("competition.", 119, c.gold), { opacity: reveal })),
      moving(
        "prices-rents",
        at(
          0,
          750,
          box({ gap: 60 }, [
            box({ gap: 12, alignItems: "baseline" }, [
              text("↑", 58, c.gold),
              text("Prices", 58, c.gold, true),
            ]),
            box({ gap: 12, alignItems: "baseline" }, [
              text("↑", 58, c.gold),
              text("Rents", 58, c.gold, true),
            ]),
          ]),
          { opacity: reveal }
        ),
        840,
        85
      ),
      at(0, 850, text("Pressure, not guaranteed price rises.", 36, c.fg)),
      at(0, 895, tag("RATES AND INCOMES ALSO MATTER")),
    ];
  };
  let nodes: unknown[];
  if (key === "label")
    nodes = [
      at(0, 295, openingLine(housingOpening(b.shortfall, story.opening).headline, 76), {
        width: 840,
      }),
      at(0, 560, openingLine(housingOpening(b.shortfall, story.opening).detail, 48, true), {
        width: 840,
      }),
      at(0, 855, tag("ILLUSTRATIVE PHOTO / NOT A MEASURED LOCATION")),
    ];
  else if (key === "facts") nodes = comparison(progress);
  else if (key === "claim") {
    nodes = competition(progress);
  } else if (key === "households") {
    const { later, years, dotX } = housingDepositGeometry(progress);
    nodes = [
      at(
        0,
        0,
        [
          at(0, 0, text("The deposit", 98, c.fg, true)),
          at(0, 118, italic("moved further away.", 76, c.gold)),
          moving("deposit-year", at(100, 290, text(later ? "2025" : "2015", 34, c.gold)), 200, 50),
          moving(
            "deposit-number",
            at(
              90,
              340,
              box({ alignItems: "baseline", gap: 15 }, [
                text(years.toFixed(1), 200, c.fg, true),
                italic("years", 65, c.gold),
              ])
            ),
            750,
            250
          ),
          at(0, 590, text("To save a modelled 20% deposit", 44, c.fg)),
          moving(
            "deposit-ruler",
            at(
              0,
              610,
              svgNode(
                `<path d="M90 50H750" stroke="${c.rule}" stroke-width="3"/><path d="M90 50H${dotX}" stroke="${c.gold}" stroke-width="4"/><path d="M90 34V66M750 34V66" stroke="${c.muted}" stroke-width="2"/><circle cx="${dotX}" cy="50" r="28" fill="${c.gold}" opacity="0.12"/><circle cx="${dotX}" cy="50" r="15" fill="${c.gold}"/><circle cx="${dotX}" cy="50" r="5" fill="${c.fg}"/>`,
                840,
                90
              )
            ),
            840,
            90,
            "timeline"
          ),
          moving(
            "deposit-start",
            at(40, 700, text(later ? "2015 / 9.0" : "2015", 32, c.muted)),
            300,
            50
          ),
          ...(later
            ? [moving("deposit-end", at(690, 700, text("2025", 32, c.gold)), 150, 50)]
            : []),
          at(0, 790, text("Saving 15% of gross median household income", 31, c.muted)),
          at(0, 835, text("each year. Median-priced dwelling.", 31, c.muted)),
          at(0, 890, tag("SEPARATE DECADE / NOT AN OBSERVED WAIT")),
        ],
        { width: 840, height: 980 }
      ),
    ];
  } else if (key === "construction") {
    const p = ease(progress * 2 - 1);
    nodes = [
      at(0, 295, text("Catching up", 126, c.fg, true)),
      at(0, 450, italic("takes years.", 134, c.gold)),
      moving("costs", at(0, 680, text("High costs.", 48, c.fg), { opacity: p }), 840, 70),
      moving(
        "labour",
        at(0, 750, text("Shortages of skilled labour.", 48, c.fg), { opacity: p }),
        840,
        70
      ),
      at(0, 860, tag("ILLUSTRATIVE BUILDING STAGE / NOT A PROJECT CLAIM")),
    ];
  } else {
    const p = ease(progress * 2 - 1),
      width = 470 + 290 * p;
    nodes = [
      at(0, 0, text("More homes.", 102, c.fg, true)),
      at(0, 116, italic("Enough to catch up.", 83, c.gold)),
      at(0, 355, text("Homes added", 39, c.gold)),
      moving(
        "catch-up",
        at(0, 420, "", { width, height: 22, backgroundColor: c.gold }),
        840,
        22,
        "rect"
      ),
      at(0, 535, text("Extra homes needed", 39, c.fg)),
      at(0, 600, "", { width: 640, height: 22, backgroundColor: c.fg }),
      at(640, 398, "", { height: 245, borderLeft: `1px solid ${c.muted}` }),
      at(0, 725, text("Add homes faster than need grows.", 43, c.fg)),
      at(0, 800, tag("NET ADDITIONS / ILLUSTRATION / NO FORECAST")),
      at(0, 890, text(`Link in bio / ${REEL_READS.housingBalance.label}`, 28, c.gold)),
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
      ...(shot ? { photoCredit: REEL_SHOTS[shot].credit } : {}),
      index: story.scenes.indexOf(scene),
      count: story.scenes.length,
      quiet: true,
      documentary: true,
      ...(background ? { background } : {}),
    },
  };
}
export async function renderHousingBalanceFrame(
  story: HousingBalanceStoryboard,
  key: string,
  progress: number,
  variant: CardVariant
) {
  const shot = reelSceneShot("housing-balance", key);
  const photo = shot ? await loadAsset(REEL_SHOTS[shot].asset) : undefined;
  if (shot && !photo) throw new Error("Reviewed archive photograph is missing.");
  const { content, meta } = housingBalanceFrameLayout(
    story,
    key,
    progress,
    variant,
    photo ?? undefined
  );
  return renderEditorialFrame(content, variant, meta);
}
