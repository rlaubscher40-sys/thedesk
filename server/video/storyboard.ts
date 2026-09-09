import type { ScriptLine } from "./narration";
import type { CardVariant } from "../og/instagramCards";
import { renderEditorialFrame } from "../og/instagramCards";
import { reelReadingCta } from "../instagram/reelCaption";

type SceneKind =
  | "opening"
  | "comparison"
  | "permission"
  | "construction"
  | "completion"
  | "supply"
  | "demand"
  | "takeaway";
export type ReelStoryboard = {
  kind: "approvals-comparison";
  period: string;
  evidenceKey: string;
  brisbane: number;
  perth: number;
  scenes: Array<{ key: string; text: string; kind: SceneKind; showPerth?: boolean }>;
};

/** Spell integer counts for the ear; the screen retains the exact numeric form. */
export function spokenCount(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0 || value > 999999)
    throw new Error("Approval count is outside the narration range.");
  const small = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const tens = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];
  const underThousand = (n: number): string => {
    if (n < 20) return small[n]!;
    if (n < 100) return tens[Math.floor(n / 10)]! + (n % 10 ? `-${small[n % 10]}` : "");
    return `${small[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${underThousand(n % 100)}` : ""}`;
  };
  return value < 1000
    ? underThousand(value)
    : `${underThousand(Math.floor(value / 1000))} thousand${value % 1000 ? `${value % 1000 < 100 ? " and" : ","} ${underThousand(value % 1000)}` : ""}`;
}

export function approvalStoryboard(
  brisbane: number,
  perth: number,
  period: string
): ReelStoryboard {
  spokenCount(brisbane);
  spokenCount(perth);
  if (!/^[A-Z][a-z]+ 20\d{2}$/.test(period)) throw new Error("Invalid approval period.");
  return {
    kind: "approvals-comparison",
    period,
    brisbane,
    perth,
    evidenceKey: `approvals:${period}:${brisbane}:${perth}`,
    scenes: [
      { key: "label", kind: "opening", text: "Are we building enough homes?" },
      {
        key: "value",
        kind: "comparison",
        showPerth: true,
        text:
          brisbane >= 1000 && perth >= 1000
            ? "Brisbane and Perth both approved thousands of homes."
            : "These are Brisbane and Perth's housing approvals.",
      },
      { key: "line", kind: "permission", text: "But approved doesn't mean built." },
      { key: "construction", kind: "construction", text: "Construction comes next." },
      { key: "completion", kind: "completion", text: "Then, a finished home." },
      {
        key: "facts",
        kind: "supply",
        text: "The real test: are homes being delivered fast enough?",
      },
      {
        key: "claim",
        kind: "demand",
        text: "Fast enough for households needing somewhere to live.",
      },
      {
        key: "signOff",
        kind: "takeaway",
        text: "That's why supply only makes sense alongside demand.",
      },
    ],
  };
}

/** Bind the pictures to the exact verified script before spending time on speech. */
export function validateStoryboard(story: ReelStoryboard, script: ScriptLine[]) {
  if (story.kind !== "approvals-comparison") throw new Error("Unknown Reel storyboard.");
  const expected = approvalStoryboard(story.brisbane, story.perth, story.period);
  if (
    JSON.stringify(story) !== JSON.stringify(expected) ||
    JSON.stringify(script) !== JSON.stringify(story.scenes.map(({ key, text }) => ({ key, text })))
  )
    throw new Error("Reel storyboard and narration do not match verified evidence.");
}

/** Each visual starts with its measured utterance, never a guessed word offset. */
export function storyboardSections(story: ReelStoryboard, durations: Record<string, number>) {
  return story.scenes.map((scene, index) => {
    const measured = durations[scene.key];
    if (!Number.isFinite(measured) || measured! <= 0)
      throw new Error("Scene has no speech timing.");
    // A short, legible build within the measured passage, then time to read.
    // Spend frames on changing information; the closing composition is static.
    const count =
      scene.kind === "takeaway"
        ? 1
        : scene.kind === "comparison"
          ? 8
          : ["permission", "construction", "completion"].includes(scene.kind)
            ? 6
            : 4;
    const steps = Array.from({ length: count }, (_, i) => (i + 1) / count);
    return {
      key: scene.key,
      seconds: measured! + (index === story.scenes.length - 1 ? 0.65 : 0.14),
      frames: steps.map((progress, i) => ({
        reveal: 1,
        sceneKey: scene.key,
        sceneProgress: progress,
        ...(i < steps.length - 1 ? { seconds: 0.08 } : {}),
      })),
    };
  });
}

type Node = { type: string; props: Record<string, unknown> };
const box = (style: Record<string, unknown>, children: unknown): Node => ({
  type: "div",
  props: { style: { display: "flex", ...style }, children },
});
const type = (text: string, size: number, color: string, serif = false): Node =>
  box(
    {
      fontFamily: serif ? "Playfair Display" : "JetBrains Mono",
      fontWeight: serif ? 700 : 400,
      fontSize: size,
      color,
      lineHeight: 1.15,
    },
    text
  );
const svg = (body: string, width: number, height: number): Node => ({
  type: "img",
  props: {
    width,
    height,
    src: `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 240 200">${body}</svg>`).toString("base64")}`,
  },
});
const house = (
  color: string,
  phase: "permission" | "construction" | "completion",
  width = 180,
  height = 150
): Node =>
  svg(
    `<g fill="none" stroke="${color}" stroke-width="4" stroke-linejoin="round">` +
      (phase === "permission"
        ? '<path d="M65 16h80l30 30v140H65z M145 16v30h30 M85 66h65 M85 86h65 M85 106h44"/><circle cx="126" cy="145" r="24"/><path d="m113 144 9 9 18-19"/>'
        : phase === "construction"
          ? '<path d="M35 173h170 M48 173V92l72-61 72 61v81 M48 92h144 M85 63v110 M155 63v110 M25 27h168 M62 27v146 M143 27v48 M127 49h31" stroke-dasharray="0"/>'
          : '<path d="M30 96 120 22l90 74 M48 82v101h144V82 M105 183v-57h32v57 M70 111h22v26H70z M151 111h22v26h-22z"/>') +
      "</g>",
    width,
    height
  );

export async function renderStoryFrame(
  story: ReelStoryboard,
  key: string,
  progress: number,
  variant: CardVariant
): Promise<Buffer> {
  const scene = story.scenes.find((s) => s.key === key);
  if (!scene || !Number.isFinite(progress) || progress < 0 || progress > 1)
    throw new Error("Invalid storyboard frame.");
  const c =
    variant === "light"
      ? { fg: "#14171F", muted: "#60636B", accent: "#916715", rule: "#D7D1C6", panel: "#EBE6DC" }
      : { fg: "#F0EDE8", muted: "#A3ADBF", accent: "#D4A853", rule: "#344057", panel: "#151E30" };
  const title = (a: string, b?: string) =>
    box({ flexDirection: "column", gap: 12 }, [
      type(a, 88, c.fg, true),
      ...(b ? [type(b, 88, c.accent, true)] : []),
    ]);
  const teal = variant === "light" ? "#286B65" : "#85C5BA";
  const phases = ["permission", "construction", "completion"] as const;
  const people = (color: string, width = 230, height = 200) =>
    svg(
      `<g fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="88" cy="49" r="21"/><circle cx="157" cy="57" r="19"/>
      <path d="M47 170v-60q0-30 41-30t41 30v60 M133 91q55-13 55 30v49 M67 122v48 M108 122v48 M169 126v44"/>
    </g>`,
      width,
      height
    );
  const badge = (text: string, color = c.accent) =>
    box(
      { padding: "12px 18px", border: `1px solid ${color}`, alignSelf: "flex-start" },
      type(text, 23, color)
    );
  const pair = (focus: "supply" | "demand" | "both") =>
    box(
      { gap: 24, height: 350 },
      (["supply", "demand"] as const).map((side) => {
        const color = side === "supply" ? c.accent : teal;
        const revealed = focus === "both" || side === "supply" || focus === "demand";
        return box(
          {
            width: 408,
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            backgroundColor: c.panel,
            borderTop: `4px solid ${color}`,
            opacity: revealed ? (focus === side ? 0.45 + progress * 0.55 : 1) : 0.2,
          },
          [
            side === "supply" ? house(color, "completion", 230, 190) : people(color, 230, 190),
            type(side === "supply" ? "HOMES DELIVERED" : "HOUSEHOLDS", 27, color),
            type(side === "supply" ? "Supply" : "Needing a home", 23, c.muted),
          ]
        );
      })
    );
  let content: Node;
  if (scene.kind === "opening") {
    content = box({ flexDirection: "column", gap: 42 }, [
      title("Are we building", "enough homes?"),
      box(
        { alignItems: "center", justifyContent: "space-between", height: 315, padding: "0 32px" },
        [
          house(c.accent, "completion", 245, 220),
          type("?", 124, c.fg, true),
          box({ opacity: 0.3 + progress * 0.7 }, people(teal, 245, 220)),
        ]
      ),
      box(
        {
          justifyContent: "space-between",
          padding: "0 24px",
          borderTop: `1px solid ${c.rule}`,
          paddingTop: 22,
        },
        [type("HOUSING SUPPLY", 27, c.accent), type("HOUSEHOLD DEMAND", 27, teal)]
      ),
      type("Brisbane + Perth", 29, c.muted),
    ]);
  } else if (scene.kind === "comparison") {
    const maximum = Math.max(
      10000,
      Math.ceil(Math.max(story.brisbane, story.perth) / 10000) * 10000
    );
    const row = (name: string, value: number, delay: number) => {
      const reveal = Math.min(1, Math.max(0, (progress - delay) / (1 - delay)));
      return box({ flexDirection: "column", gap: 16 }, [
        box({ justifyContent: "space-between", alignItems: "center" }, [
          type(name, 27, c.muted),
          type(value.toLocaleString("en-AU"), 76, c.fg, true),
        ]),
        box({ height: 84, backgroundColor: c.panel, borderLeft: `2px solid ${c.muted}` }, [
          box(
            {
              width: `${(value / maximum) * 100 * reveal}%`,
              height: 84,
              backgroundColor: c.accent,
            },
            ""
          ),
        ]),
      ]);
    };
    content = box({ flexDirection: "column", gap: 35 }, [
      title("Homes", "approved."),
      type(`12 MONTHS TO ${story.period.toUpperCase()}`, 26, c.muted),
      row("GREATER BRISBANE", story.brisbane, 0),
      row("GREATER PERTH", story.perth, 0.25),
      box({ justifyContent: "space-between", borderTop: `1px solid ${c.rule}`, paddingTop: 12 }, [
        type("0", 22, c.muted),
        type(`${maximum.toLocaleString("en-AU")} dwellings`, 22, c.muted),
      ]),
      badge("APPROVALS ARE THE START"),
    ]);
  } else if (phases.includes(scene.kind as (typeof phases)[number])) {
    const active = phases.indexOf(scene.kind as (typeof phases)[number]);
    const phase = phases[active]!;
    const labels = ["APPROVED", "UNDER CONSTRUCTION", "FINISHED"];
    // Keep the site in the same position as the permit gives way to the building.
    // Illustrative stages, with no invented attrition rate or delivery deadline.
    content = box({ flexDirection: "column", gap: 28 }, [
      title(
        ...([
          ["Permission", "to build."],
          ["Then comes", "construction."],
          ["Then, a", "finished home."],
        ][active]! as [string, string])
      ),
      box(
        {
          position: "relative",
          height: 385,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.panel,
        },
        [
          ...(active > 0
            ? [
                box(
                  { position: "absolute", opacity: (1 - progress) * 0.6 },
                  house(c.muted, phases[active - 1]!, 410, 350)
                ),
              ]
            : []),
          box({ opacity: progress }, house(c.accent, phase, 410, 350)),
        ]
      ),
      box(
        { gap: 12 },
        phases.map((_, i) =>
          box(
            {
              width: 272,
              height: 65,
              alignItems: "center",
              justifyContent: "center",
              borderTop: `4px solid ${i <= active ? c.accent : c.rule}`,
              opacity: i <= active ? 1 : 0.4,
            },
            type(
              ["01 APPROVAL", "02 BUILD", "03 FINISH"][i]!,
              23,
              i === active ? c.accent : c.muted
            )
          )
        )
      ),
      badge(labels[active]!),
      type(
        active === 0
          ? "The totals count permission."
          : active === 1
            ? "Approval does not guarantee delivery."
            : "Now look at demand.",
        26,
        c.muted
      ),
    ]);
  } else if (scene.kind === "supply" || scene.kind === "demand") {
    const isDemand = scene.kind === "demand";
    content = box({ flexDirection: "column", gap: 44 }, [
      title(
        ...((isDemand ? ["Enough homes", "for whom?"] : ["Homes delivered.", "Fast enough?"]) as [
          string,
          string,
        ])
      ),
      pair(scene.kind),
      box(
        { height: 10, backgroundColor: c.rule },
        box({ width: `${progress * 100}%`, backgroundColor: isDemand ? teal : c.accent }, "")
      ),
      type(
        isDemand ? "People needing somewhere to live." : "Supply has to be read beside demand.",
        35,
        c.fg,
        true
      ),
      type("Compare the same area and period.", 25, c.muted),
    ]);
  } else {
    content = box({ flexDirection: "column", gap: 35 }, [
      title("Is supply", "keeping up?"),
      pair("both"),
      type("Approvals alone can't answer that.", 36, c.fg, true),
      box({ flexDirection: "column", gap: 12, paddingTop: 25, borderTop: `1px solid ${c.rule}` }, [
        type("Open our bio. Choose:", 25, c.muted),
        type(reelReadingCta("supplyComparison").fact.caption, 26, c.accent),
      ]),
    ]);
  }
  return renderEditorialFrame(content, variant, {
    kicker: "THE HOUSING QUESTION / SUPPLY + DEMAND",
    source: `ABS Building Approvals · Year to ${story.period}`,
    index: story.scenes.indexOf(scene),
    count: story.scenes.length,
  });
}
