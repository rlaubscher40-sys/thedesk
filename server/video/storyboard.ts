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
  | "takeaway";
export type ReelStoryboard = {
  kind: "approvals-comparison";
  period: string;
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
  const a = spokenCount(brisbane),
    b = spokenCount(perth);
  if (!/^[A-Z][a-z]+ 20\d{2}$/.test(period)) throw new Error("Invalid approval period.");
  return {
    kind: "approvals-comparison",
    period,
    brisbane,
    perth,
    scenes: [
      { key: "label", kind: "opening", text: "Approved. But ready to move in?" },
      { key: "value", kind: "comparison", text: `Brisbane: ${a} approvals.` },
      { key: "line", kind: "comparison", showPerth: true, text: `Perth: ${b}.` },
      {
        key: "claim",
        kind: "comparison",
        showPerth: true,
        text: `Both cover the year to ${period}.`,
      },
      { key: "facts", kind: "permission", text: "That's permission to build." },
      { key: "construction", kind: "construction", text: "Construction is a separate step." },
      { key: "completion", kind: "completion", text: "Check completions against local demand." },
      {
        key: "signOff",
        kind: "takeaway",
        text: reelReadingCta("supplyComparison").voice,
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
    const steps = ["permission", "construction", "completion"].includes(scene.kind)
      ? [1]
      : [0.35, 0.7, 1];
    // Reveal only changing elements. Stage highlights each hold on one frame.
    return {
      key: scene.key,
      seconds: measured! + (index === story.scenes.length - 1 ? 0.65 : 0.14),
      frames: steps.map((progress, i) => ({
        reveal: 1,
        sceneKey: scene.key,
        sceneProgress: progress,
        ...(i < steps.length - 1 ? { seconds: 0.1 } : {}),
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
          : '<path d="M30 96 120 22l90 74 M48 82v101h144V82 M105 183v-57h32v57 M70 111h22v26H70 M151 111h22v26h-22"/>') +
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
  let content: Node;
  if (scene.kind === "opening") {
    content = box({ flexDirection: "column", gap: 70 }, [
      title("Approved.", "But completed?"),
      box(
        {
          height: 355,
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 24px",
          borderTop: `1px solid ${c.rule}`,
          borderBottom: `1px solid ${c.rule}`,
        },
        [
          box({ flexDirection: "column", alignItems: "center", gap: 24 }, [
            house(c.accent, "permission", 245, 220),
            type("PERMISSION", 24, c.accent),
          ]),
          svg(
            `<path d="M55 78h130 M55 122h130 M156 40 84 160" fill="none" stroke="${c.muted}" stroke-width="10" stroke-linecap="round"/>`,
            90,
            90
          ),
          box({ flexDirection: "column", alignItems: "center", gap: 24, opacity: progress }, [
            house(c.fg, "completion", 245, 220),
            type("FINISHED HOME", 24, c.fg),
          ]),
        ]
      ),
      type("Brisbane · Perth", 30, c.muted),
    ]);
  } else if (scene.kind === "comparison") {
    const maximum = Math.max(
      10000,
      Math.ceil(Math.max(story.brisbane, story.perth) / 10000) * 10000
    );
    const row = (name: string, value: number, active: boolean, shown: boolean) =>
      box({ flexDirection: "column", gap: 20, opacity: shown ? 1 : 0.28 }, [
        box({ justifyContent: "space-between", alignItems: "center" }, [
          type(name, 28, active ? c.accent : c.muted),
          type(shown ? value.toLocaleString("en-AU") : "—", 70, c.fg, true),
        ]),
        box({ height: 90, backgroundColor: c.panel, borderLeft: `2px solid ${c.muted}` }, [
          box(
            {
              width: shown ? `${(value / maximum) * 100 * (active ? progress : 1)}%` : 0,
              height: 90,
              backgroundColor: active ? c.accent : c.muted,
            },
            ""
          ),
        ]),
      ]);
    content = box({ flexDirection: "column", gap: 48 }, [
      title("Two cities.", "One measure."),
      type(`DWELLING APPROVALS · YEAR TO ${story.period.toUpperCase()}`, 23, c.muted),
      row("GREATER BRISBANE", story.brisbane, key === "value", true),
      row("GREATER PERTH", story.perth, key === "line", Boolean(scene.showPerth)),
      box({ justifyContent: "space-between", borderTop: `1px solid ${c.rule}`, paddingTop: 14 }, [
        type("0", 22, c.muted),
        type(`${maximum.toLocaleString("en-AU")} dwellings`, 22, c.muted),
      ]),
      ...(key === "claim"
        ? [
            box({ flexDirection: "column", gap: 20 }, [
              box(
                { gap: 8 },
                Array.from({ length: 12 }, (_, i) =>
                  box(
                    {
                      width: 57,
                      height: 20,
                      backgroundColor: i < Math.ceil(progress * 12) ? c.accent : c.rule,
                    },
                    ""
                  )
                )
              ),
              type("12 months · Same period · Original counts", 24, c.muted),
            ]),
          ]
        : []),
    ]);
  } else if (["permission", "construction", "completion"].includes(scene.kind)) {
    const phases = ["permission", "construction", "completion"] as const;
    const active = phases.indexOf(scene.kind as (typeof phases)[number]);
    content = box({ flexDirection: "column", gap: 40 }, [
      title("Three different", "stages."),
      ...phases.map((phase, i) =>
        box(
          {
            alignItems: "center",
            gap: 30,
            padding: "18px 24px",
            height: 190,
            border: `2px solid ${i === active ? c.accent : c.rule}`,
            backgroundColor: c.panel,
            opacity: i > active ? 0.35 : 1,
          },
          [
            house(i === active ? c.accent : c.muted, phase),
            box({ flexDirection: "column", gap: 14 }, [
              type(
                ["01  APPROVAL", "02  CONSTRUCTION", "03  COMPLETION"][i]!,
                29,
                i === active ? c.accent : c.fg
              ),
              type(
                ["Permission to build", "Building the home", "A finished dwelling"][i]!,
                27,
                c.muted
              ),
            ]),
          ]
        )
      ),
      type("Approvals count the first stage.", 24, c.muted),
    ]);
  } else {
    content = box({ flexDirection: "column", gap: 55 }, [
      title("What actually", "gets built?"),
      box(
        {
          alignItems: "center",
          gap: 30,
          padding: 28,
          borderTop: `1px solid ${c.rule}`,
          borderBottom: `1px solid ${c.rule}`,
        },
        [
          house(c.accent, "completion"),
          box({ flexDirection: "column", gap: 18 }, [
            type("COMPLETIONS", 34, c.fg),
            type("The homes delivered", 26, c.muted),
          ]),
        ]
      ),
      box({ flexDirection: "column", gap: 18, opacity: progress }, [
        type("+ LOCAL DEMAND", 34, c.accent),
        type("Approval counts alone", 43, c.fg, true),
        type("don't establish a shortage.", 43, c.fg, true),
      ]),
      box({ flexDirection: "column", gap: 16, marginTop: 18 }, [
        type("Open our bio. Choose:", 27, c.fg),
        type(reelReadingCta("supplyComparison").fact.caption, 26, c.accent),
      ]),
    ]);
  }
  return renderEditorialFrame(content, variant, {
    kicker: "BEFORE YOU BUY / HOUSING SUPPLY",
    source: `ABS Building Approvals · Year to ${story.period}`,
    index: story.scenes.indexOf(scene),
    count: story.scenes.length,
  });
}
