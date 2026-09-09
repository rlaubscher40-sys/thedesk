import { matchedHousingBalance, type HousingBalanceSnapshot } from "../../shared/housingBalance";
import { renderEditorialFrame, type CardVariant } from "../og/instagramCards";
import { spokenCount } from "./spokenNumbers";
import { REEL_READS } from "../instagram/reelCaption";

type Kind =
  | "balance-opening"
  | "balance-contrast"
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
        text: "Australia built over a quarter of a million homes.",
      },
      {
        key: "contrast",
        kind: "balance-contrast",
        text: "Yet housing supply still fell behind demand.",
      },
      {
        key: "value",
        kind: "balance-net",
        text: `After demolitions: ${spokenCount(b.net)} net new homes.`,
      },
      {
        key: "line",
        kind: "balance-demand",
        text: `Estimated new demand: ${spokenCount(b.demand)} homes.`,
      },
      { key: "facts", kind: "balance-gap", text: `A gap of ${spokenCount(b.shortfall)} homes.` },
      {
        key: "claim",
        kind: "balance-ratio",
        text: `About ${spokenCount(b.netPer100)} net new homes for every hundred needed.`,
      },
      {
        key: "signOff",
        kind: "balance-takeaway",
        text: "New supply didn't even cover new demand.",
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

export async function renderHousingBalanceFrame(
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
  const title = (a: string, z?: string) =>
    box({ flexDirection: "column", gap: 12 }, [
      text(a, 84, c.fg, true),
      ...(z ? [text(z, 84, c.gold, true)] : []),
    ]);
  const tag = (s: string) => text(s, 25, c.muted);
  const scale = 300000;
  const row = (label: string, target: number, color: string, reveal = 1) => {
    const tick = balanceCountFrame(target, reveal, scale);
    return box({ flexDirection: "column", gap: 12 }, [
      text(label, 25, color),
      box(
        { height: 108, justifyContent: "flex-end", alignItems: "center" },
        text(number(tick.value), 94, c.fg)
      ),
      box(
        { height: 66, backgroundColor: c.panel, borderRadius: 5, overflow: "hidden" },
        box({ height: 66, width: `${tick.widthPercent}%`, backgroundColor: color }, "")
      ),
    ]);
  };
  const axis = () =>
    box({ justifyContent: "space-between", borderTop: `1px solid ${c.rule}`, paddingTop: 12 }, [
      text("0", 21, c.muted),
      text("300,000 homes", 21, c.muted),
    ]);
  let content: Node;
  if (scene.kind === "balance-opening" || scene.kind === "balance-contrast") {
    const contrast = scene.kind === "balance-contrast";
    content = box({ flexDirection: "column", gap: 32 }, [
      tag(contrast ? "THE PROBLEM" : "THE CONSTRUCTION HEADLINE"),
      text(
        contrast ? "Still not" : "263,000",
        contrast ? 112 : 172,
        contrast ? c.fg : c.gold,
        true
      ),
      text(contrast ? "enough." : "homes built.", 94, contrast ? c.gap : c.fg, true),
      box(
        {
          height: 180,
          gap: 30,
          alignItems: "flex-end",
          borderBottom: `2px solid ${c.rule}`,
          paddingBottom: 25,
        },
        Array.from({ length: 5 }, (_, i) =>
          houseSvg(contrast && i > 2 ? c.rule : c.gold, 130, 90 + (i % 3) * 24)
        )
      ),
      text(
        contrast ? "New supply did not cover new demand." : "July 2024 to December 2025",
        42,
        contrast ? c.fg : c.muted,
        true
      ),
      tag("18 months · Approximate completions"),
    ]);
  } else if (scene.kind === "balance-net") {
    content = box({ flexDirection: "column", gap: 32 }, [
      text("What was actually added?", 62, c.fg, true),
      box({ justifyContent: "space-between", padding: 26, backgroundColor: c.panel }, [
        box({ flexDirection: "column", gap: 15 }, [
          text(number(b.gross), 62, c.fg, true),
          tag("COMPLETED"),
        ]),
        text("-", 65, c.gap),
        box({ flexDirection: "column", gap: 15 }, [
          text(number(b.impliedRemovals), 62, c.gap, true),
          tag("DEMOLITIONS*"),
        ]),
      ]),
      row("NET NEW HOMES", b.net, c.gold, progress),
      axis(),
      text("Not every new home adds to supply.", 38, c.fg, true),
      tag("*Approximate difference from rounded figures."),
    ]);
  } else if (scene.kind === "balance-demand") {
    content = box({ flexDirection: "column", gap: 34 }, [
      text("Demand grew. Supply lagged.", 61, c.fg, true),
      row("NET NEW SUPPLY", b.net, c.gold),
      row("ESTIMATED NEW DEMAND", b.demand, c.teal, progress),
      axis(),
      text("New households need somewhere to live.", 35, c.fg, true),
      tag("Same country. Same 18 months."),
    ]);
  } else if (scene.kind === "balance-gap") {
    const tick = balanceCountFrame(b.shortfall, progress, scale);
    content = box({ flexDirection: "column", gap: 26 }, [
      tag("NEW DEMAND MINUS NET NEW SUPPLY"),
      box({ height: 192, alignItems: "center" }, text(number(tick.value), 160, c.gap)),
      text("homes short.", 80, c.fg, true),
      tag("Gap added in 18 months · Approximate"),
      box({ height: 88, backgroundColor: c.panel }, [
        box({ width: `${(b.net / scale) * 100}%`, backgroundColor: c.gold }, ""),
        box({ width: `${tick.widthPercent}%`, backgroundColor: c.gap }, ""),
      ]),
      axis(),
      box({ justifyContent: "space-between" }, [
        text("ADDED", 23, c.gold),
        text("SHORTFALL", 23, c.gap),
      ]),
      text(`${number(b.demand)} needed - ${number(b.net)} added`, 29, c.fg),
      text("New demand outpaced net new supply.", 35, c.fg, true),
      tag("This is not the total accumulated shortage."),
    ]);
  } else if (scene.kind === "balance-ratio") {
    const shown = Math.round(b.netPer100 * progress);
    content = box({ flexDirection: "column", gap: 24 }, [
      box({ alignItems: "baseline", gap: 18, height: 165 }, [
        text(String(shown), 150, c.gold),
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
                { width: 70, height: 37, opacity: i < shown ? 1 : 0.45 },
                houseSvg(i < shown ? c.gold : c.gap, 46, 37)
              );
            })
          )
        )
      ),
      box({ justifyContent: "space-between", paddingTop: 12 }, [
        text("GOLD: NET NEW SUPPLY", 23, c.gold),
        text("UNFILLED: THE GAP", 23, c.gap),
      ]),
      tag("Rounded ratio · Icons are not individual homes"),
    ]);
  } else {
    content = box({ flexDirection: "column", gap: 35 }, [
      title("New supply", "didn't keep up."),
      box({ padding: 30, backgroundColor: c.panel, flexDirection: "column", gap: 22 }, [
        text(`About ${number(b.shortfall)} homes`, 59, c.gap, true),
        text("short of new demand.", 42, c.fg, true),
      ]),
      text("More construction does not automatically mean catching up.", 42, c.fg, true),
      tag("Australia · July 2024 to December 2025"),
      box({ borderTop: `1px solid ${c.rule}`, paddingTop: 22, flexDirection: "column", gap: 14 }, [
        tag("Figures and calculation: link in bio"),
        text(REEL_READS.housingBalance.label, 27, c.gold),
      ]),
    ]);
  }
  return renderEditorialFrame(content, variant, {
    kicker: "AUSTRALIA / JUL 2024 TO DEC 2025",
    source: "Based on NHSAC 2026 data · Historical estimates",
    index: story.scenes.indexOf(scene),
    count: story.scenes.length,
  });
}
