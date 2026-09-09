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
      scene(
        "label",
        "balance-opening",
        ["Why can we build more homes,", "and still have a housing shortage?"],
        1
      ),
      scene("contrast", "balance-contrast", [
        "Homes added have to keep up",
        "with extra homes needed.",
      ]),
      scene(
        "households",
        "balance-households",
        ["Someone moves out.", "One household becomes two, needing two homes."],
        0
      ),
      scene(
        "value",
        "balance-net",
        [
          "In eighteen months, Australia added",
          `about ${spokenCount(b.net)} homes after demolitions.`,
        ],
        1
      ),
      scene(
        "line",
        "balance-demand",
        ["But we needed an estimated", `${spokenCount(b.demand)} extra homes.`],
        1
      ),
      scene("facts", "balance-gap", [`So the gap grew by ${spokenCount(b.shortfall)} homes.`], 0),
      scene("claim", "balance-ratio", [
        `About ${spokenCount(b.netPer100)} added for every hundred needed.`,
      ]),
      scene(
        "signOff",
        "balance-takeaway",
        [
          "To ease the shortage, we have to build faster than need grows.",
          "Just keeping up won't close the existing gap.",
        ],
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
/** Illustrative geometry only: equal growth preserves a gap; faster additions
 * can close it. No axis values or forecast dates are assigned. */
export function housingGapIllustration(mode: "keep-up" | "catch-up", progress: number) {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1)
    throw new Error("Invalid illustration progress");
  const needY = 54 - progress * 30;
  const supplyY = 114 - progress * (mode === "keep-up" ? 30 : 90);
  return { x: 24 + progress * 640, needY, supplyY, gap: supplyY - needY };
}
const box = (style: Record<string, unknown>, children: unknown): Node => ({
  type: "div",
  props: { style: { display: "flex", ...style }, children },
});
const text = (value: string, size: number, color: string, serif = false): Node =>
  box(
    {
      fontFamily: serif ? "Desk Sans" : "JetBrains Mono",
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
  const row = (
    label: string,
    value: number,
    color: string,
    gapReveal = 0,
    removed = 0,
    compare = false
  ) => {
    return box({ flexDirection: "column", gap: 12, width: 840 }, [
      text(label, 25, color),
      box(
        { height: 108, justifyContent: "flex-end", alignItems: "center" },
        // The measured lead-in can last two seconds. A waiting reveal must
        // not look like an observation of zero housing need.
        text(value === 0 ? " " : number(value), 94, c.fg)
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
          ...(compare && value > 0
            ? [
                box(
                  {
                    position: "absolute",
                    left: `${(b.net / scale) * 100}%`,
                    height: 66,
                    borderLeft: `3px dashed ${c.fg}`,
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
    content = box({ flexDirection: "column", gap: 44, paddingTop: 25 }, [
      text("More homes.", 102, c.fg, true),
      box(
        { gap: 24, marginTop: 20 },
        Array.from({ length: 5 }, (_, i) =>
          box(
            { opacity: Math.min(1, Math.max(0.12, progress * 10 - i)) },
            houseSvg(c.gold, 140, 125)
          )
        )
      ),
      box(
        {
          flexDirection: "column",
          gap: 14,
          marginTop: 55,
          opacity: Math.max(0, Math.min(1, (progress - 0.5) * 4)),
        },
        [text("Still a", 100, c.fg, true), text("shortage?", 120, c.gap, true)]
      ),
    ]);
  } else if (scene.kind === "balance-contrast") {
    content = box({ flexDirection: "column", gap: 36, paddingTop: 15 }, [
      text("The housing equation.", 68, c.fg, true),
      box(
        {
          padding: 30,
          backgroundColor: c.panel,
          borderLeft: `7px solid ${c.gold}`,
          opacity: Math.min(1, progress * 4),
          flexDirection: "column",
          gap: 12,
        },
        [text("SUPPLY", 26, c.gold), text("Homes added", 58, c.fg, true)]
      ),
      box(
        {
          padding: 30,
          backgroundColor: c.panel,
          borderLeft: `7px solid ${c.teal}`,
          opacity: Math.max(0, Math.min(1, (progress - 0.5) * 4)),
          flexDirection: "column",
          gap: 12,
        },
        [text("DEMAND", 26, c.teal), text("Extra homes needed", 54, c.fg, true)]
      ),
      box({ gap: 25, marginTop: 12, alignItems: "center" }, [
        ...(sourceCover
          ? [{ type: "img", props: { src: sourceCover, width: 120, height: 170 } }]
          : []),
        box({ width: 680, flexDirection: "column", gap: 12 }, [
          text("National Housing Supply and Affordability Council", 27, c.fg, true),
          text("State of the Housing System 2026", 24, c.muted),
          text("30 APRIL 2026 / P. 21", 22, c.muted),
        ]),
      ]),
    ]);
  } else if (scene.kind === "balance-households") {
    const moved = progress;
    const eased = moved * moved * (3 - 2 * moved);
    const person = (x: number, colour: string) =>
      `<g transform="translate(${x} 205)" fill="none" stroke="${colour}" stroke-width="5" stroke-linecap="round"><circle cy="-28" r="12"/><path d="M-20 37V6q0-19 20-19t20 19v31 M-8 18v41 M8 18v41"/></g>`;
    const roof = (x: number, colour: string) =>
      `<g transform="translate(${x} 0)" fill="none" stroke="${colour}" stroke-width="5" stroke-linejoin="round"><path d="M0 130 140 30l140 100 M25 115v175h230V115"/></g>`;
    const diagram = `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="350" viewBox="0 0 840 350">${roof(10, c.gold)}<g opacity="${0.15 + eased * 0.85}">${roof(540, c.teal)}</g>${person(95, c.gold)}${person(160, c.gold)}${person(225 + eased * 450, c.teal)}<path d="M340 110h130m-15-15 15 15-15 15" fill="none" stroke="${c.muted}" stroke-width="3"/></svg>`;
    content = box({ flexDirection: "column", gap: 40, paddingTop: 50 }, [
      text("Moving out.", 88, c.fg, true),
      text("Same people. Two homes.", 48, c.teal, true),
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
        tag("PARENTS’ HOME"),
        box({ opacity: progress }, text("ANOTHER HOME NEEDED", 25, c.teal)),
      ]),
      text(
        progress === 1 ? "2 households need 2 homes." : "1 household needs 1 home.",
        38,
        c.fg,
        true
      ),
      text("One way housing need grows.", 30, c.teal, true),
      text("Illustrative example", 24, c.muted),
    ]);
  } else if (["balance-net", "balance-demand", "balance-gap"].includes(scene.kind)) {
    const netScene = scene.kind === "balance-net";
    const gapScene = scene.kind === "balance-gap";
    const supply = netScene ? balanceCountFrame(b.net, progress).value : b.net;
    const demand = netScene ? 0 : gapScene ? b.demand : balanceCountFrame(b.demand, progress).value;
    const gap = gapScene ? balanceCountFrame(b.shortfall, progress).value : 0;
    // Identical positions and a common scale across all three spoken passages.
    content = box({ flexDirection: "column", gap: 40, paddingTop: 35 }, [
      box(
        { height: 130, alignItems: "flex-start" },
        gapScene
          ? box({ flexDirection: "column", gap: 9 }, [
              text("THE GAP GREW BY", 29, c.muted),
              box({ alignItems: "baseline", gap: 20 }, [
                text(number(gap), 80, c.gap),
                text("homes.", 50, c.fg, true),
              ]),
            ])
          : text(netScene ? "What we added." : "What we needed.", 72, c.fg, true)
      ),
      row("HOMES ADDED", supply, c.gold, 0, 0),
      box(
        { height: 244, alignItems: "flex-start" },
        netScene
          ? box({ flexDirection: "column", gap: 18, paddingTop: 28 }, [
              text("After demolitions", 36, c.muted),
              text("18 months / Australia", 25, c.muted),
            ])
          : row("ESTIMATED EXTRA HOMES NEEDED", demand, c.teal, gap, 0, true)
      ),
      axis(),
    ]);
  } else if (scene.kind === "balance-takeaway") {
    const illustration = (mode: "keep-up" | "catch-up", p: number, active: boolean) => {
      const f = housingGapIllustration(mode, p);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="145" viewBox="0 0 760 145"><path d="M24 54L${f.x} ${f.needY}" fill="none" stroke="${c.teal}" stroke-width="8" stroke-linecap="round"/><path d="M24 114L${f.x} ${f.supplyY}" fill="none" stroke="${c.gold}" stroke-width="8" stroke-linecap="round"/><circle cx="${f.x}" cy="${f.needY}" r="7" fill="${c.teal}"/><circle cx="${f.x}" cy="${f.supplyY}" r="7" fill="${c.gold}"/>${f.gap > 1 ? `<path d="M${f.x + 22} ${f.needY}h12v${f.gap}h-12" fill="none" stroke="${c.gap}" stroke-width="4"/>` : ""}</svg>`;
      return box(
        {
          padding: 24,
          flexDirection: "column",
          gap: 8,
          borderLeft: `6px solid ${active ? c.fg : c.rule}`,
          backgroundColor: c.panel,
        },
        [
          box({ justifyContent: "space-between", alignItems: "baseline" }, [
            text(mode === "keep-up" ? "Meet new need" : "Outpace new need", 37, c.fg, true),
            text(
              mode === "keep-up" ? "Gap stays" : "Gap closes",
              30,
              mode === "keep-up" ? c.gap : c.gold,
              true
            ),
          ]),
          {
            type: "img",
            props: {
              width: 760,
              height: 145,
              src: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
            },
          },
        ]
      );
    };
    content = box({ flexDirection: "column", gap: 24, paddingTop: 20 }, [
      text("Keeping up is not catching up.", 74, c.fg, true),
      box({ gap: 38 }, [text("Homes added", 27, c.gold), text("Extra need", 27, c.teal)]),
      illustration("keep-up", Math.max(0, (progress - 0.5) * 2), progress >= 0.5),
      illustration("catch-up", Math.min(1, progress * 2), progress < 0.5),
      text("Illustration, not a forecast", 23, c.muted),
      box({ flexDirection: "column", gap: 12, marginTop: 8 }, [
        tag("Full source: link in bio"),
        text(REEL_READS.housingBalance.label, 27, c.gold),
      ]),
    ]);
  } else {
    // The grid describes this historical flow, never total accumulated shortage.
    const shown = Math.round(b.netPer100 * progress);
    const complete = progress === 1;
    content = box({ flexDirection: "column", gap: 32, paddingTop: 25 }, [
      box({ alignItems: "baseline", gap: 18, height: 165 }, [
        box({ width: 210, justifyContent: "flex-end" }, text(String(shown), 150, c.gold)),
        text("/ 100", 70, c.muted),
      ]),
      text("For every 100 extra homes needed.", 38, c.fg, true),
      box(
        { flexDirection: "column", gap: 8 },
        Array.from({ length: 10 }, (_, r) =>
          box(
            { gap: 14 },
            Array.from({ length: 10 }, (_, col) => {
              const i = r * 10 + col;
              return box(
                {
                  width: 70,
                  height: 42,
                  borderRadius: 5,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: i < shown ? c.gold : complete ? c.gap : c.panel,
                  opacity: i < shown || complete ? 1 : 0.5,
                },
                houseSvg(i < shown || complete ? "#101923" : c.muted, 38, 33)
              );
            })
          )
        )
      ),
      complete
        ? box({ justifyContent: "space-between", width: 840 }, [
            text(`${b.netPer100} added`, 29, c.gold),
            text(`${100 - b.netPer100} gap`, 29, c.gap),
          ])
        : text("Approximate ratio", 29, c.muted),
    ]);
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
