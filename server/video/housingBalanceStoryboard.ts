import { matchedHousingBalance, type HousingBalanceSnapshot } from "../../shared/housingBalance";
import { renderEditorialFrame, type CardVariant } from "../og/instagramCards";
import { spokenCount } from "./spokenNumbers";
import { REEL_READS } from "../instagram/reelCaption";

type Kind =
  | "balance-opening"
  | "balance-households"
  | "balance-net"
  | "balance-demand"
  | "balance-gap"
  | "balance-ratio"
  | "balance-takeaway";
export type HousingBalanceStoryboard = {
  kind: "housing-balance";
  evidence: HousingBalanceSnapshot;
  scenes: Array<{
    key: string;
    text: string;
    kind: Kind;
    phrases: string[];
    motionPhrase?: number;
  }>;
};
export function housingBalanceStoryboard(
  evidence: HousingBalanceSnapshot
): HousingBalanceStoryboard {
  const b = matchedHousingBalance(evidence);
  if (!b || b.shortfall <= 0) throw new Error("No verified housing supply shortfall.");
  const scene = (key: string, kind: Kind, phrases: string[], motionPhrase?: number) => ({
    key,
    kind,
    text: phrases.join(" "),
    phrases,
    ...(motionPhrase === undefined ? {} : { motionPhrase }),
  });
  return {
    kind: "housing-balance",
    evidence: structuredClone(evidence),
    scenes: [
      scene("label", "balance-opening", ["More homes.", "A bigger housing gap."], 1),
      scene(
        "value",
        "balance-net",
        [`Australia added about ${spokenCount(b.net)} homes, after demolitions.`],
        0
      ),
      scene(
        "line",
        "balance-demand",
        [
          "Over the same eighteen months,",
          `we needed an estimated ${spokenCount(b.demand)} extra homes.`,
        ],
        1
      ),
      scene(
        "facts",
        "balance-gap",
        [`An extra gap of about ${spokenCount(b.shortfall)} homes.`],
        0
      ),
      scene("claim", "balance-ratio", [
        `About ${spokenCount(b.netPer100)} added for every hundred needed.`,
      ]),
      scene(
        "households",
        "balance-households",
        ["The Council links high housing and living costs to adult children staying home longer."],
        0
      ),
      scene(
        "signOff",
        "balance-takeaway",
        ["To close a shortage,", "homes added must outpace extra homes needed."],
        1
      ),
    ],
  };
}
export function validateHousingBalanceStoryboard(
  story: HousingBalanceStoryboard,
  script: Array<{ key: string; text: string }>
) {
  const expected = housingBalanceStoryboard(story.evidence);
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
    value: [b.net],
    line: [b.demand],
    facts: [b.shortfall],
    claim: [b.netPer100, 100],
  };
  return script.map(({ key, text }) => {
    const replacements: Array<[string, string]> = [];
    for (const count of counts[key] ?? []) {
      const spoken = count === 100 ? "hundred" : spokenCount(count);
      if (!text.includes(spoken)) throw new Error("Verified subtitle count is missing.");
      text = text.replace(spoken, count.toLocaleString("en-AU"));
      replacements.push([spoken, count.toLocaleString("en-AU")]);
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

/** All four quantitative scenes share these physical anchors and one scale. */
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
  const supply =
    key === "label" ? balanceCountFrame(b.net, Math.min(1, progress * 2)).value : b.net;
  const demand = key === "line" ? balanceCountFrame(b.demand, progress).value : b.demand;
  const gap = key === "facts" ? balanceCountFrame(b.shortfall, progress).value : 0;
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

/** Original symbolic illustration, not a photograph of an affected household. */
function movingOutIllustration(progress: number, gold: string, ink: string, muted: string) {
  const p = ease(progress);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="430" viewBox="0 0 840 430">
  <g fill="none" stroke="${muted}" stroke-width="1.5">
    <path d="M24 362H815 M578 362V52H768V362 M588 352V62H758V352"/>
    <path d="M630 352V90L747 65V353" stroke="${ink}" stroke-width="2"/>
    <path d="M650 130L724 115V231L650 235Z M650 255L724 256V320L650 313Z" opacity=".45"/>
  </g>
  <path d="M588 352V62H747L630 90V352Z" fill="${gold}" opacity=".07"/>
  <circle cx="648" cy="246" r="4" fill="${gold}"/>
  <g transform="translate(${p * 30} 0)" fill="none" stroke="${gold}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="118" cy="202" r="55"/><circle cx="118" cy="202" r="34" stroke-width="1.5" opacity=".45"/>
    <path d="M173 202H360V234H336V219H308V237H280V202"/>
  </g>
  <path d="M420 202H${420 + 120 * p}" stroke="${gold}" stroke-width="2" stroke-dasharray="3 10"/>
  <path d="M555 186V218 M566 186V218" stroke="${gold}" stroke-width="3" opacity="${p}"/>
  </svg>`;
  return {
    type: "img",
    props: {
      width: 840,
      height: 430,
      src: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    },
  };
}

export function housingBalanceFrameLayout(
  story: HousingBalanceStoryboard,
  key: string,
  progress: number,
  variant: CardVariant
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
  const g = housingBalanceGeometry(story, key, progress);
  const row = (need: boolean) => {
    const value = need ? g.demand : g.supply,
      width = need ? g.demandWidth : g.supplyWidth;
    return at(
      0,
      need ? BALANCE_CHART.demandTop : BALANCE_CHART.supplyTop,
      [
        at(0, 59, text(need ? "Extra homes needed" : "Homes added", 35, c.muted)),
        at(0, 0, text(value ? n(value) : " ", 111, c.fg, true), {
          width: 840,
          justifyContent: "flex-end",
        }),
        at(0, 148, "", { width: 840, height: 22, backgroundColor: c.track }),
        at(0, 148, "", { width, height: 22, backgroundColor: need ? c.fg : c.gold }),
        ...(need && value > b.net
          ? [at(g.gapLeft, 134, "", { height: 51, borderLeft: `2px solid ${c.gold}` })]
          : []),
        ...(need && g.gap > 0
          ? [at(g.gapLeft, 148, "", { width: g.gapWidth, height: 22, backgroundColor: c.gold })]
          : []),
      ],
      { width: 840, height: 185 }
    );
  };
  let nodes: unknown[];
  if (["balance-opening", "balance-net", "balance-demand", "balance-gap"].includes(scene.kind)) {
    nodes = [row(false)];
    if (key === "label") {
      const second = ease((progress - 0.5) * 2);
      nodes.push(
        at(0, 0, text("More homes.", 102, c.fg, true)),
        at(0, 125, italic("Still behind.", 111, c.gold), {
          opacity: second,
          transform: `translateY(${12 * (1 - second)}px)`,
        }),
        at(
          0,
          535,
          box({ flexDirection: "column", gap: 20 }, [
            tag("NET ADDITIONS"),
            text("After demolitions. Over 18 months.", 36, c.muted),
          ])
        )
      );
    } else if (key === "value") {
      nodes.push(
        at(0, 0, text("Homes added.", 96, c.fg, true)),
        at(0, 125, italic("After demolitions.", 78, c.gold)),
        at(
          0,
          550,
          box({ flexDirection: "column", gap: 26 }, [
            text("Homes completed", 47, c.fg),
            box({ gap: 24, opacity: 0.25 + 0.75 * ease(progress) }, [
              text("−", 50, c.gold),
              text("Homes demolished", 47, c.muted),
            ]),
            box({ height: 1, width: 840, backgroundColor: c.rule }, ""),
            text("= Net homes added", 41, c.fg),
          ])
        )
      );
    } else if (key === "line") {
      nodes.push(
        at(0, 0, text("But we needed", 91, c.fg, true)),
        at(0, 120, italic("more.", 119, c.gold)),
        row(true),
        at(0, 775, tag("SAME COUNTRY / SAME 18 MONTHS"))
      );
    } else {
      nodes.push(
        at(0, 0, tag("THE ADDITIONAL GAP")),
        at(
          0,
          40,
          box({ alignItems: "baseline", gap: 24 }, [
            text(g.gap ? n(g.gap) : " ", 145, c.gold, true),
            italic("homes.", 61, c.fg),
          ])
        ),
        row(true),
        at(g.gapLeft, 749, "", {
          width: g.gapWidth,
          height: 30,
          borderBottom: `2px solid ${c.gold}`,
          borderLeft: `2px solid ${c.gold}`,
          borderRight: `2px solid ${c.gold}`,
        }),
        at(0, 850, text("The shortage grew during these 18 months.", 37, c.muted))
      );
    }
    // The visual source remains at the same place across this whole passage.
    nodes.push(
      at(
        0,
        920,
        box({ width: 840, justifyContent: "space-between" }, [tag("0"), tag("300,000 HOMES")])
      )
    );
  } else if (scene.kind === "balance-ratio") {
    const shown = Math.round(b.netPer100 * progress);
    nodes = [
      at(0, 0, text("For every 100", 89, c.fg, true)),
      at(0, 112, italic("homes needed.", 91, c.gold)),
      at(
        0,
        330,
        box(
          { flexDirection: "column", gap: 27 },
          Array.from({ length: 10 }, (_, r) =>
            box(
              { gap: 27 },
              Array.from({ length: 10 }, (_, col) => {
                const i = r * 10 + col;
                return box(
                  {
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: i < shown ? c.gold : "transparent",
                    border: `1.5px solid ${i < shown ? c.gold : c.rule}`,
                  },
                  ""
                );
              })
            )
          )
        )
      ),
      at(
        545,
        365,
        box({ flexDirection: "column", gap: 2 }, [
          text(String(shown), 172, c.fg, true),
          text("added", 44, c.gold),
        ])
      ),
      at(
        545,
        650,
        box({ flexDirection: "column", gap: 12, opacity: progress === 1 ? 1 : 0 }, [
          italic("19 short.", 63, c.muted),
        ])
      ),
      at(0, 895, text("Approximate ratio, not a count of households.", 32, c.muted)),
    ];
  } else if (scene.kind === "balance-households") {
    nodes = [
      at(0, 0, text("A place of your own.", 75, c.fg, true)),
      at(0, 112, italic("Later.", 132, c.gold)),
      at(0, 300, movingOutIllustration(progress, c.gold, c.fg, c.muted)),
      at(
        0,
        748,
        box({ flexDirection: "column", gap: 22 }, [
          text("Adult children staying home longer.", 44, c.fg),
          text("The Council links this to high housing and living costs.", 33, c.muted),
          tag("ILLUSTRATION / REPORTED CONTEXT"),
        ])
      ),
    ];
  } else {
    const p = ease((progress - 0.5) * 2),
      supply = 470 + 290 * p;
    nodes = [
      at(0, 0, text("To close the gap,", 90, c.fg, true)),
      at(0, 120, italic("get ahead.", 115, c.gold), { opacity: p }),
      at(0, 340, text("Homes added", 39, c.gold)),
      at(0, 410, "", { width: supply, height: 22, backgroundColor: c.gold }),
      at(0, 525, text("Extra homes needed", 39, c.fg)),
      at(0, 595, "", { width: 640, height: 22, backgroundColor: c.fg }),
      at(640, 389, "", { height: 250, borderLeft: `1px solid ${c.muted}` }),
      at(0, 700, text("Add homes faster than new need grows.", 43, c.fg)),
      at(0, 778, tag("ILLUSTRATION / NO FORECAST")),
      at(
        0,
        884,
        box({ flexDirection: "column", gap: 12 }, [
          tag("FULL COMPARISON / LINK IN BIO"),
          text(REEL_READS.housingBalance.label, 32, c.gold),
        ])
      ),
    ];
  }
  return {
    content: box({ width: 840, height: 980, position: "relative" }, nodes),
    meta: {
      kicker:
        key === "households"
          ? "HOUSING AFFORDABILITY / REPORTED CONTEXT"
          : "AUSTRALIA / JUL 2024 TO DEC 2025",
      source:
        key === "households"
          ? "NHSAC 2026 / p. 44 / Reported context"
          : "NHSAC 2026 / p. 21 / Approximate figures",
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
  const { content, meta } = housingBalanceFrameLayout(story, key, progress, variant);
  return renderEditorialFrame(content, variant, meta);
}
