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
        [`Australia added about ${spokenCount(b.net)} homes.`, "Yet the housing gap grew."],
        1
      ),
      scene("contrast", "balance-contrast", [
        "The report compares homes added",
        "with extra homes needed.",
      ]),
      scene(
        "households",
        "balance-households",
        [
          "The Council links high housing and living costs",
          "to adult children staying home longer.",
        ],
        1
      ),
      scene("value", "balance-net", ["Supply is homes added,", "after demolitions."], 1),
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
        ["Building more isn't enough.", "To close the shortage, we must outpace new need."],
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
    label: [b.net],
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

export function housingBalanceFrameLayout(
  story: HousingBalanceStoryboard,
  key: string,
  progress: number,
  variant: CardVariant,
  sourceCover?: string,
  sourceExcerpts?: { net: string; need: string }
) {
  const b = matchedHousingBalance(story.evidence),
    scene = story.scenes.find((s) => s.key === key);
  if (!b || !scene || !Number.isFinite(progress) || progress < 0 || progress > 1)
    throw new Error("Invalid housing balance frame.");
  const c =
    variant === "light"
      ? { fg: "#171B21", muted: "#66635C", gold: "#946C29", rule: "#CEC7BA", track: "#E6E0D4" }
      : { fg: "#F0EDE6", muted: "#A4A29C", gold: "#C5A267", rule: "#3B3E40", track: "#1A2026" };
  const n = (v: number) => v.toLocaleString("en-AU");
  const tag = (v: string) =>
    box({ fontFamily: "JetBrains Mono", fontSize: 23, color: c.muted, letterSpacing: 2 }, v);
  const rule = (width = 840) => box({ width, height: 1, backgroundColor: c.rule }, "");
  const row = (label: string, value: number, need = false, gap = 0) =>
    box({ width: 840, flexDirection: "column", gap: 20 }, [
      box({ justifyContent: "space-between", alignItems: "baseline" }, [
        text(label, 35, c.muted),
        text(value ? n(value) : " ", 88, c.fg, true),
      ]),
      box({ height: 28, width: 840, position: "relative", backgroundColor: c.track }, [
        box(
          { width: (value / 300000) * 840, height: 28, backgroundColor: need ? c.fg : c.gold },
          ""
        ),
        ...(need && value > 0
          ? [
              box(
                {
                  position: "absolute",
                  left: (b.net / 300000) * 840,
                  top: -12,
                  height: 52,
                  borderLeft: `2px solid ${c.gold}`,
                },
                ""
              ),
            ]
          : []),
        ...(gap
          ? [
              box(
                {
                  position: "absolute",
                  left: (b.net / 300000) * 840,
                  width: (gap / 300000) * 840,
                  height: 28,
                  backgroundColor: c.gold,
                },
                ""
              ),
            ]
          : []),
      ]),
    ]);
  let content: Node;
  if (scene.kind === "balance-opening") {
    const shown = balanceCountFrame(b.net, Math.min(1, progress * 2)).value;
    content = box({ flexDirection: "column", gap: 28, paddingTop: 55 }, [
      tag("THE HOUSING FILE"),
      text(shown ? n(shown) : " ", 186, c.fg, true),
      text("homes added.", 70, c.fg, true),
      rule(150),
      box(
        {
          flexDirection: "column",
          marginTop: 48,
          opacity: Math.max(0, Math.min(1, (progress - 0.5) * 4)),
        },
        [italic("And still,", 77, c.muted), italic("further behind.", 85, c.gold)]
      ),
      tag("Net additions / 18 months"),
    ]);
  } else if (scene.kind === "balance-contrast") {
    const part = Math.max(0, Math.min(1, (progress - 0.5) * 4));
    const extract = (src: string | undefined, width: number, height: number) =>
      src ? { type: "img", props: { src, width, height } } : text("Source excerpt", 30, "#222222");
    content = box({ flexDirection: "column", gap: 34, paddingTop: 25 }, [
      text("The evidence.", 91, c.fg, true),
      text("State of the Housing System 2026", 36, c.muted),
      box({ flexDirection: "column", gap: 35, padding: 38, backgroundColor: "#FAF9F5" }, [
        text("EXTRACTS / PAGE 21", 23, "#67635A"),
        text("Homes added, after demolitions", 32, "#37342D"),
        extract(sourceExcerpts?.net, 764, 52),
        box({ height: 2, width: 764 * Math.min(1, progress * 4), backgroundColor: "#AA853D" }, ""),
        box({ flexDirection: "column", gap: 24, opacity: part }, [
          text("Extra homes needed", 32, "#37342D"),
          extract(sourceExcerpts?.need, 390, 79),
          box({ height: 2, width: 390, backgroundColor: "#AA853D" }, ""),
        ]),
      ]),
      text("National Housing Supply and Affordability Council", 34, c.fg),
      tag("30 APRIL 2026 / ORIGINAL EXCERPTS"),
    ]);
  } else if (scene.kind === "balance-households") {
    content = box({ flexDirection: "column", gap: 38, paddingTop: 35 }, [
      tag("THE HUMAN CONTEXT"),
      text("Leaving home.", 89, c.fg, true),
      italic("Later.", 120, c.gold),
      rule(150),
      box({ flexDirection: "column", gap: 20, marginTop: 20, opacity: 0.3 + 0.7 * progress }, [
        italic("“adult children staying in the parental home for longer.”", 58, c.fg),
      ]),
      text("The Council links this to high housing and living costs.", 35, c.muted),
      tag("NHSAC 2026 / PAGE 44"),
    ]);
  } else if (["balance-net", "balance-demand", "balance-gap"].includes(scene.kind)) {
    const net = scene.kind === "balance-net",
      gapScene = scene.kind === "balance-gap";
    const supply = net ? balanceCountFrame(b.net, progress).value : b.net;
    const demand = gapScene ? b.demand : balanceCountFrame(b.demand, progress).value;
    const gap = gapScene ? balanceCountFrame(b.shortfall, progress).value : 0;
    content = box({ flexDirection: "column", gap: 65, paddingTop: 40 }, [
      box(
        { height: 180, flexDirection: "column", gap: 12 },
        gapScene
          ? [
              tag("THE GAP GREW BY"),
              box({ gap: 20, alignItems: "baseline" }, [
                text(n(gap), 112, c.gold, true),
                italic("homes.", 54, c.fg),
              ]),
            ]
          : [
              text(net ? "What we added." : "What we needed.", 78, c.fg, true),
              ...(net ? [text("Supply means homes added after demolitions.", 36, c.muted)] : []),
            ]
      ),
      row("Homes added", supply),
      box(
        { height: 230, flexDirection: "column", paddingTop: 20 },
        net
          ? [italic("Completions, less demolitions.", 46, c.muted)]
          : [row("Estimated extra homes needed", demand, true, gap)]
      ),
      box({ justifyContent: "space-between", borderTop: `1px solid ${c.rule}`, paddingTop: 15 }, [
        tag("0"),
        tag("300,000 HOMES"),
      ]),
    ]);
  } else if (scene.kind === "balance-ratio") {
    const shown = Math.round(b.netPer100 * progress);
    content = box({ flexDirection: "column", gap: 40, paddingTop: 60 }, [
      tag("FOR EVERY 100 EXTRA HOMES NEEDED"),
      box({ alignItems: "baseline", gap: 24, height: 220 }, [
        text(String(shown), 240, c.fg, true),
        italic("added.", 84, c.gold),
      ]),
      box(
        { flexDirection: "column", gap: 16, marginTop: 15 },
        Array.from({ length: 5 }, (_, r) =>
          box(
            { gap: 18 },
            Array.from({ length: 20 }, (_, col) => {
              const i = r * 20 + col;
              return box(
                { width: 24, height: 46, backgroundColor: i < shown ? c.gold : c.track },
                ""
              );
            })
          )
        )
      ),
      box({ opacity: progress === 1 ? 1 : 0, flexDirection: "column", gap: 16, marginTop: 35 }, [
        italic(`${100 - b.netPer100} short.`, 78, c.muted),
        text("Approximate ratio, over these 18 months.", 31, c.muted),
      ]),
    ]);
  } else {
    const catchup = Math.max(0, Math.min(1, (progress - 0.5) * 2));
    content = box({ flexDirection: "column", gap: 42, paddingTop: 30 }, [
      tag("THE TAKEAWAY"),
      text("More building.", 89, c.fg, true),
      box(
        {
          opacity: Math.max(0, Math.min(1, (progress - 0.5) * 4)),
          flexDirection: "column",
          gap: 16,
        },
        [italic("Enough to", 86, c.gold), italic("catch up?", 108, c.gold)]
      ),
      rule(150),
      text("Homes added must outpace extra homes needed.", 48, c.fg),
      box({ position: "relative", marginTop: 30, height: 68, width: 800 }, [
        box(
          {
            position: "absolute",
            left: 0,
            top: 26,
            width: 800,
            height: 2,
            backgroundColor: c.rule,
          },
          ""
        ),
        box(
          {
            position: "absolute",
            left: 0,
            top: 21,
            width: 500 + 270 * catchup,
            height: 12,
            backgroundColor: c.gold,
          },
          ""
        ),
        box(
          { position: "absolute", left: 610, top: 0, height: 58, borderLeft: `2px solid ${c.fg}` },
          ""
        ),
      ]),
      text("Illustration / marker = new need", 25, c.muted),
      box({ flexDirection: "column", gap: 12, marginTop: 25 }, [
        tag("FULL SOURCE / LINK IN BIO"),
        text(REEL_READS.housingBalance.label, 31, c.gold),
      ]),
    ]);
  }
  return {
    content,
    meta: {
      kicker: "AUSTRALIA / JUL 2024 TO DEC 2025",
      source:
        key === "households"
          ? "NHSAC 2026 / p. 44 / Reported context"
          : "Based on NHSAC 2026 / Approximate figures",
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
  const net = key === "contrast" ? await loadAsset("nhsac-net-extract.png") : undefined;
  const need = key === "contrast" ? await loadAsset("nhsac-need-extract.png") : undefined;
  if (key === "contrast" && (!net || !need))
    throw new Error("Verified report excerpts are missing.");
  const { content, meta } = housingBalanceFrameLayout(
    story,
    key,
    progress,
    variant,
    undefined,
    net && need ? { net, need } : undefined
  );
  return renderEditorialFrame(content, variant, meta);
}
