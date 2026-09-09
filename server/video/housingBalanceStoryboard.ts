import { matchedHousingBalance, type HousingBalanceSnapshot } from "../../shared/housingBalance";
import { renderEditorialFrame, loadAsset, type CardVariant } from "../og/instagramCards";
import { spokenCount } from "./spokenNumbers";
import { REEL_READS } from "../instagram/reelCaption";

type Kind =
  | "balance-opening"
  | "balance-contrast"
  | "balance-households"
  | "balance-net"
  | "balance-demand"
  | "balance-gap"
  | "balance-ratio"
  | "balance-takeaway";
export type HousingBalanceStoryboard = {
  kind: "housing-balance";
  evidence: HousingBalanceSnapshot;
  scenes: Array<{ key: string; text: string; kind: Kind }>;
};
export function housingBalanceStoryboard(
  evidence: HousingBalanceSnapshot
): HousingBalanceStoryboard {
  const b = matchedHousingBalance(evidence);
  if (!b || b.shortfall <= 0) throw new Error("No verified housing supply shortfall.");
  return {
    kind: "housing-balance",
    evidence: structuredClone(evidence),
    scenes: [
      {
        key: "label",
        kind: "balance-opening",
        text: "Over a quarter of a million homes built.",
      },
      {
        key: "contrast",
        kind: "balance-contrast",
        text: "Why wasn't it enough?",
      },
      {
        key: "households",
        kind: "balance-households",
        text: "Someone moves out. Another home is needed.",
      },
      {
        key: "value",
        kind: "balance-net",
        text: `After demolitions: ${spokenCount(b.net)} added.`,
      },
      {
        key: "line",
        kind: "balance-demand",
        text: `We needed about ${spokenCount(b.demand)} homes.`,
      },
      {
        key: "facts",
        kind: "balance-gap",
        text: `${spokenCount(b.shortfall)[0]!.toUpperCase() + spokenCount(b.shortfall).slice(1)} more than we added.`,
      },
      {
        key: "claim",
        kind: "balance-ratio",
        text: `About ${spokenCount(b.netPer100)} added for every hundred needed.`,
      },
      {
        key: "signOff",
        kind: "balance-takeaway",
        text: "Next headline: how many homes added?",
      },
      {
        key: "checkNeed",
        kind: "balance-takeaway",
        text: "And how many needed?",
      },
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
      fontFamily: serif ? "Playfair Display" : "JetBrains Mono",
      fontSize: size,
      fontWeight: serif ? 700 : 400,
      color,
      lineHeight: 1.12,
    },
    value
  );
const houseSvg = (color: string, width: number, height: number) => ({
  type: "img",
  props: {
    width,
    height,
    src: `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 60 52"><path d="M5 24 30 3l25 21 M12 19v29h36V19 M25 48V32h11v16 M17 26h5v6h-5z M40 26h5v6h-5z" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/></svg>`).toString("base64")}`,
  },
});

export function housingBalanceFrameLayout(
  story: HousingBalanceStoryboard,
  key: string,
  progress: number,
  variant: CardVariant,
  sourceCover?: string
) {
  const b = matchedHousingBalance(story.evidence),
    scene = story.scenes.find((s) => s.key === key);
  if (!b || !scene || !Number.isFinite(progress) || progress < 0 || progress > 1)
    throw new Error("Invalid housing balance frame.");
  const c =
    variant === "light"
      ? {
          fg: "#14171F",
          muted: "#60636B",
          gold: "#916715",
          teal: "#286B65",
          gap: "#A0452D",
          panel: "#EBE6DC",
          rule: "#D7D1C6",
        }
      : {
          fg: "#F0EDE8",
          muted: "#A3ADBF",
          gold: "#D4A853",
          teal: "#85C5BA",
          gap: "#E89576",
          panel: "#151E30",
          rule: "#344057",
        };
  const number = (n: number) => n.toLocaleString("en-AU");
  const tag = (s: string) => text(s, 25, c.muted);
  const scale = 300000;
  const row = (label: string, value: number, color: string, gapReveal = 0, removed = 0) => {
    return box({ flexDirection: "column", gap: 12, width: 840 }, [
      text(label, 25, color),
      box(
        { height: 108, justifyContent: "flex-end", alignItems: "center" },
        text(number(value), 94, c.fg)
      ),
      box(
        {
          height: 66,
          position: "relative",
          backgroundColor: c.panel,
          borderRadius: 5,
          overflow: "hidden",
        },
        [
          box({ height: 66, width: `${(value / scale) * 100}%`, backgroundColor: color }, ""),
          ...(removed > 0
            ? [
                box(
                  {
                    height: 66,
                    width: `${(removed / scale) * 100}%`,
                    backgroundColor: c.gap,
                    opacity: 1 - removed / b.impliedRemovals,
                  },
                  ""
                ),
              ]
            : []),
          ...(gapReveal > 0
            ? [
                box(
                  {
                    position: "absolute",
                    left: `${(b.net / scale) * 100}%`,
                    width: `${(gapReveal / scale) * 100}%`,
                    height: 66,
                    backgroundColor: c.gap,
                  },
                  ""
                ),
              ]
            : []),
        ]
      ),
    ]);
  };
  const axis = () =>
    box({ justifyContent: "space-between", borderTop: `1px solid ${c.rule}`, paddingTop: 12 }, [
      text("0", 21, c.muted),
      text("300,000 homes", 21, c.muted),
    ]);
  let content: Node;
  if (scene.kind === "balance-opening") {
    content = box({ flexDirection: "column", gap: 32, paddingTop: 55 }, [
      text(number(b.gross), 172, c.gold, true),
      text("homes built.", 88, c.fg, true),
      box({ marginTop: 55, flexDirection: "column", gap: 12 }, [
        text("So why did", 76, c.fg, true),
        text("the gap grow?", 88, c.gap, true),
      ]),
    ]);
  } else if (scene.kind === "balance-contrast") {
    content = box({ flexDirection: "column", gap: 55, paddingTop: 40 }, [
      text("Follow the numbers.", 78, c.fg, true),
      box({ gap: 36, alignItems: "center" }, [
        ...(sourceCover
          ? [{ type: "img", props: { src: sourceCover, width: 340, height: 480 } }]
          : []),
        box({ width: 460, flexDirection: "column", gap: 28 }, [
          text("National Housing Supply and Affordability Council", 35, c.fg, true),
          text("State of the Housing System 2026", 29, c.gold),
          text("30 APRIL 2026 / P. 21", 23, c.muted),
        ]),
      ]),
    ]);
  } else if (scene.kind === "balance-households") {
    const moved = Math.max(0, Math.min(1, (progress - 0.15) / 0.65));
    const eased = moved * moved * (3 - 2 * moved);
    const person = (x: number, colour: string) =>
      `<g transform="translate(${x} 205)" fill="none" stroke="${colour}" stroke-width="5" stroke-linecap="round"><circle cy="-28" r="12"/><path d="M-20 37V6q0-19 20-19t20 19v31 M-8 18v41 M8 18v41"/></g>`;
    const roof = (x: number, colour: string) =>
      `<g transform="translate(${x} 0)" fill="none" stroke="${colour}" stroke-width="5" stroke-linejoin="round"><path d="M0 130 140 30l140 100 M25 115v175h230V115"/></g>`;
    const diagram = `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="350" viewBox="0 0 840 350">${roof(10, c.gold)}<g opacity="${0.15 + eased * 0.85}">${roof(540, c.teal)}</g>${person(95, c.gold)}${person(160, c.gold)}${person(225 + eased * 450, c.teal)}<path d="M340 110h130m-15-15 15 15-15 15" fill="none" stroke="${c.muted}" stroke-width="3"/></svg>`;
    content = box({ flexDirection: "column", gap: 40, paddingTop: 50 }, [
      text("People move.", 88, c.fg, true),
      text("Households form.", 80, c.teal, true),
      box(
        { marginTop: 35 },
        {
          type: "img",
          props: {
            width: 840,
            height: 350,
            src: `data:image/svg+xml;base64,${Buffer.from(diagram).toString("base64")}`,
          },
        }
      ),
      box({ width: 840, justifyContent: "space-between" }, [
        tag("EXISTING HOUSEHOLD"),
        text("ANOTHER HOME NEEDED", 25, c.teal),
      ]),
      text("One example of how housing need grows.", 26, c.muted),
    ]);
  } else if (["balance-net", "balance-demand", "balance-gap"].includes(scene.kind)) {
    const netScene = scene.kind === "balance-net";
    const gapScene = scene.kind === "balance-gap";
    const removed = netScene
      ? balanceCountFrame(b.impliedRemovals, progress).value
      : b.impliedRemovals;
    const supply = b.gross - removed;
    const demand = netScene ? 0 : gapScene ? b.demand : balanceCountFrame(b.demand, progress).value;
    const gap = gapScene ? balanceCountFrame(b.shortfall, progress).value : 0;
    // Identical positions and a common scale across all three spoken passages.
    content = box({ flexDirection: "column", gap: 40, paddingTop: 35 }, [
      box(
        { height: 130, alignItems: "flex-start" },
        gapScene
          ? box({ alignItems: "baseline", gap: 20 }, [
              text(number(gap), 80, c.gap),
              text("homes short.", 50, c.fg, true),
            ])
          : text(netScene ? "After demolitions." : "Supply vs demand.", 72, c.fg, true)
      ),
      row("NET NEW SUPPLY", supply, c.gold, 0, netScene && progress < 1 ? removed : 0),
      box(
        { height: 244, alignItems: "flex-start" },
        netScene
          ? box({ flexDirection: "column", gap: 18, paddingTop: 28 }, [
              text(`~${number(removed)} demolished*`, 38, c.gap),
              text("*Implied by rounded figures", 23, c.muted),
            ])
          : row("ESTIMATED EXTRA HOMES NEEDED", demand, c.teal, gap)
      ),
      axis(),
    ]);
  } else if (scene.kind === "balance-ratio") {
    const shown = Math.round(b.netPer100 * progress);
    content = box({ flexDirection: "column", gap: 32, paddingTop: 25 }, [
      box({ alignItems: "baseline", gap: 18, height: 165 }, [
        box({ width: 210, justifyContent: "flex-end" }, text(String(shown), 150, c.gold)),
        text("/ 100", 70, c.muted),
      ]),
      text("Net new homes for every 100 needed.", 38, c.fg, true),
      box(
        { flexDirection: "column", gap: 8 },
        Array.from({ length: 10 }, (_, r) =>
          box(
            { gap: 14 },
            Array.from({ length: 10 }, (_, col) => {
              const i = r * 10 + col;
              return box(
                { width: 70, height: 37, opacity: i < shown || progress === 1 ? 1 : 0.35 },
                houseSvg(i < shown ? c.gold : progress === 1 ? c.gap : c.muted, 46, 37)
              );
            })
          )
        )
      ),
      text(
        progress === 1
          ? `${100 - b.netPer100} missing. For every 100 needed.`
          : "Approximate ratio",
        29,
        progress === 1 ? c.gap : c.muted
      ),
    ]);
  } else {
    const second = key === "checkNeed";
    const question = (n: string, label: string, colour: string, visible = true) =>
      box({ height: 145, alignItems: "center", gap: 28, opacity: visible ? 1 : 0 }, [
        text(n, 35, colour),
        text(label, 62, c.fg, true),
      ]);
    content = box(
      { flexDirection: "column", height: 800, justifyContent: "space-between", paddingTop: 45 },
      [
        box({ flexDirection: "column", gap: 24 }, [
          text("Two questions.", 86, c.gold, true),
          question("01", "Homes added?", c.gold),
          question("02", "Extra homes needed?", c.teal, second),
          box({ opacity: second ? 1 : 0 }, tag("Same place. Same period.")),
        ]),
        box({ flexDirection: "column", gap: 18, opacity: second ? 1 : 0 }, [
          tag("Figures and sources in bio"),
          text(REEL_READS.housingBalance.label, 27, c.gold),
        ]),
      ]
    );
  }

  return {
    content,
    meta: {
      kicker: "AUSTRALIA / JUL 2024 TO DEC 2025",
      source: "Based on NHSAC 2026 · Approximate figures",
      index: story.scenes.indexOf(scene),
      count: story.scenes.length,
      quiet: true,
    },
  };
}

export async function renderHousingBalanceFrame(
  story: HousingBalanceStoryboard,
  key: string,
  progress: number,
  variant: CardVariant
) {
  const cover = key === "contrast" ? await loadAsset("nhsac-2026-cover.jpg") : undefined;
  if (key === "contrast" && !cover) throw new Error("Verified NHSAC report cover is missing.");
  const { content, meta } = housingBalanceFrameLayout(
    story,
    key,
    progress,
    variant,
    cover ?? undefined
  );
  return renderEditorialFrame(content, variant, meta);
}
