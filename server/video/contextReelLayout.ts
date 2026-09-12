import type { CardVariant } from "../og/instagramCards";
import { evidenceOpening } from "./reelOpening";
import { evidenceBarGeometry, type EvidenceVisual } from "./evidenceVisual";
import { moving, smooth, type MotionNode } from "./reelMotion";
import { exampleRepayments, loanDollars } from "../../shared/loanRepaymentExample";
import { rentCueProgress } from "./rentComparisonLayout";
import type { MeasuredPhrase } from "./phraseSpeech";
import { REEL_SHOTS, reelSceneShot } from "./reelVisualStandard";

/** Keep the first result in place while the shorter term is spoken. The first
 * claim phrase introduces assumptions; only the second starts the dollar count. */
export function repaymentCueProgress(
  key: string,
  time: number,
  phrases: MeasuredPhrase[]
): [number, number] {
  if (key === "claim") return [rentCueProgress(time, phrases, 1), 0];
  if (key === "facts") return [1, rentCueProgress(time, phrases, 0)];
  return [0, 0];
}

const box = (style: Record<string, unknown>, children: unknown): MotionNode => ({
  type: "div",
  props: { style: { display: "flex", ...style }, children },
});
const at = (x: number, y: number, children: unknown, style: Record<string, unknown> = {}) =>
  box({ position: "absolute", left: x, top: y, width: 840 - x, ...style }, children);

/** Observed series and explicitly labelled repayment illustration never share
 * a chart. Counts and bars use the same eased, measured-speech progress. */
export function contextReelLayout(
  v: EvidenceVisual,
  key: string,
  motion: { progress: number; rates: [number, number]; repayment?: [number, number] },
  variant: CardVariant
) {
  const migration = v.recipe === "interstate-migration";
  const c =
    variant === "light"
      ? { fg: "#171B21", muted: "#66635C", gold: "#946C29", track: "#DED8CD" }
      : { fg: "#F0EDE6", muted: "#A4A29C", gold: "#C5A267", track: "#30363C" };
  const text = (s: string, size = 44, colour = c.fg, serif = false): MotionNode => {
    const n = box(
      {
        width: "100%",
        fontFamily: serif ? "Playfair Display" : "Desk Editorial Sans",
        fontWeight: serif ? 700 : 400,
        fontSize: size,
        color: colour,
        lineHeight: 1.14,
      },
      s
    );
    n.props["data-reel-safe-text"] = true;
    return n;
  };
  const title = (a: string, b: string) => [
    at(0, 0, text(a, a.length > 22 ? 62 : 78, c.fg, true)),
    at(0, 112, text(b, 48, c.gold)),
  ];
  const rule = (id: string, y: number, p = motion.progress) =>
    moving(
      id,
      at(0, y, "", { width: 840 * smooth(p), height: 2, backgroundColor: c.gold }),
      840,
      2,
      "rect"
    );
  const reveal = (id: string, y: number, s: string, delay = 0) =>
    moving(id, at(0, y, text(s, 48), { opacity: smooth(motion.progress * 2 - delay) }), 840, 150);
  const amount = (value: number, p: number) =>
    migration
      ? `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.round(Math.abs(value) * p).toLocaleString("en-AU")}`
      : `${(value * p).toFixed(1)}%`;
  const chart = () => {
    const values = v.rows.map((r) => r.value);
    return v.rows.flatMap((r, i) => {
      const p = key === "value" ? motion.rates[i]! : 1;
      const bar = evidenceBarGeometry(values, p, 840).bars[i]!;
      const y = migration ? 260 + i * 245 : 540 + i * 175;
      return [
        at(0, y, text(r.label, 36, c.muted)),
        moving(
          `number-${i}`,
          at(
            0,
            y + (migration ? 48 : 36),
            text(amount(r.value, p), migration ? 104 : 80, i ? c.fg : c.gold, true),
            {
              opacity: key === "value" && p === 0 ? 0 : 1,
            }
          ),
          840,
          130
        ),
        at(0, y + (migration ? 177 : 137), "", {
          width: 840,
          height: 10,
          backgroundColor: c.track,
        }),
        at(evidenceBarGeometry(values, 1, 840).zero, y + (migration ? 169 : 129), "", {
          width: 1,
          height: 26,
          backgroundColor: c.muted,
        }),
        moving(
          `bar-${i}`,
          at(bar.left, y + (migration ? 177 : 137), "", {
            width: bar.width,
            height: 10,
            backgroundColor: i ? c.fg : c.gold,
          }),
          840,
          10,
          "rect"
        ),
      ];
    });
  };
  let nodes: MotionNode[];
  if (key === "label") {
    if (!migration)
      nodes = [
        at(0, 610, text(evidenceOpening(v.recipe, v.rows).headline, 78, c.fg, true)),
        at(0, 725, text(evidenceOpening(v.recipe, v.rows).detail, 56, c.gold, true)),
      ];
    else {
      nodes = title(
        migration ? "People move." : "The cost of a loan.",
        migration ? "Demand changes places." : "What borrowers are paying."
      );
      nodes.push(
        rule("hook", 290),
        at(
          0,
          355,
          text(migration ? "Queensland / Western Australia" : "Owner-occupiers / Investors", 42)
        ),
        at(
          0,
          510,
          text(
            migration ? "Two states. One measure." : "Two averages. Your own costs.",
            64,
            c.fg,
            true
          )
        ),
        at(0, 800, text(v.period, 30, c.muted))
      );
    }
  } else if (key === "value" || (!migration && key === "line")) {
    nodes = migration
      ? title(
          migration ? "The net movement." : "New home loans.",
          migration ? "Arrivals minus departures." : "Average rate per year."
        )
      : [
          at(0, 340, text("New home loans.", 76, c.fg, true)),
          at(0, 445, text(`Average annual rate / ${v.period}`, 36, c.gold)),
        ];
    nodes.push(
      ...chart(),
      ...(migration ? [at(0, 800, text(v.period, 30, c.muted))] : []),
      at(
        0,
        migration ? 870 : 900,
        text(
          migration
            ? "PEOPLE / STATE TOTALS"
            : key === "line"
              ? "AVERAGES / NOT PERSONAL OFFERS"
              : "ALL INSTITUTIONS / FIXED + VARIABLE",
          27,
          c.muted
        )
      )
    );
  } else if (key === "line") {
    nodes = title("What does net mean?", "Count both directions.");
    nodes.push(
      reveal("arrivals", 290, "Interstate arrivals"),
      at(0, 395, text("−", 90, c.gold, true)),
      reveal("departures", 510, "Interstate departures", 0.45),
      rule("net-line", 650),
      at(0, 720, text("Net change", 70, c.gold, true)),
      at(0, 855, text("Not the total number of arrivals", 32, c.muted))
    );
  } else if (!migration && (key === "claim" || key === "facts")) {
    nodes = [
      at(0, 270, text("Same loan. Different term.", 62, c.fg, true)),
      at(0, 365, text("$500,000 / 6% a year", 42, c.gold)),
    ];
    const rows = exampleRepayments();
    const amounts = rows.map((r) => r.monthly);
    const progress = motion.repayment ?? [1, key === "facts" ? 1 : 0];
    nodes.push(
      at(0, 435, text("ILLUSTRATION / NOT AN OFFER", 28, c.muted)),
      ...rows.flatMap((r, i) => {
        const p = progress[i]!;
        const y = 510 + i * 175;
        const colour = i ? c.gold : c.fg;
        const show = i === 0 || key === "facts" ? 1 : 0;
        return [
          moving(
            `term-${i}`,
            at(0, y, text(`${r.years} years`, 36, c.muted), { opacity: show }),
            840,
            50
          ),
          moving(
            `repayment-${i}`,
            at(0, y + 35, text(loanDollars(r.monthly * p), 80, colour, true), {
              width: 425,
              opacity: p > 0 ? 1 : 0,
            }),
            425,
            120
          ),
          moving(
            `monthly-${i}`,
            at(455, y + 73, text("/ month", 36, c.muted), { opacity: p > 0 ? 1 : 0 }),
            385,
            60
          ),
          moving(
            `repayment-track-${i}`,
            at(0, y + 140, "", { width: 840, height: 10, backgroundColor: c.track, opacity: show }),
            840,
            10,
            "rect"
          ),
          moving(
            `repayment-bar-${i}`,
            at(0, y + 140, "", {
              width: evidenceBarGeometry(amounts, p, 840).bars[i]!.width,
              height: 10,
              backgroundColor: colour,
            }),
            840,
            10,
            "rect"
          ),
        ];
      }),
      moving(
        "term-tradeoff",
        at(0, 860, text("Shorter term. Less total interest.", 36, c.gold), {
          opacity: key === "facts" ? progress[1] : 0,
        }),
        840,
        70
      ),
      at(0, 915, text("Monthly P&I / rounded $ / unchanged rate", 28, c.muted)),
      at(0, 945, text("No fees or extra payments", 28, c.muted))
    );
  } else if (key === "claim") {
    nodes = title("A change of address.", "A different place to live.");
    const labels = ["Leaves one state", "Moves across a border", "Needs a home in another"];
    nodes.push(
      ...labels.flatMap((s, i) => [
        moving(
          `step-${i}`,
          at(0, 295 + i * 180, text(String(i + 1).padStart(2, "0"), 34, c.gold), {
            width: 80,
            opacity: smooth(motion.progress * 3 - i),
          }),
          80,
          50
        ),
        moving(
          `input-${i}`,
          at(100, 290 + i * 180, text(s, 48), {
            width: 740,
            opacity: smooth(motion.progress * 3 - i),
          }),
          740,
          125
        ),
      ])
    );
    nodes.push(at(0, 890, text("Conceptual flow / not a measured route", 28, c.muted)));
  } else if (key === "facts") {
    nodes = title("A state is not a suburb.", "Look where homes are needed.");
    nodes.push(
      reveal("check-1", 310, "Local household growth"),
      rule("check-rule", 460),
      reveal("check-2", 540, "Vacant and completed homes", 0.5),
      at(0, 805, text("State migration alone cannot establish a local shortage.", 40, c.muted))
    );
  } else if (key === "signOff") {
    if (!migration)
      nodes = [
        at(0, 590, text("Compare the whole loan.", 72, c.fg, true)),
        at(0, 800, text("Amount. Term. Fees.", 50, c.gold)),
        at(0, 890, text("Read the evidence / link in bio", 32, c.muted)),
      ];
    else {
      nodes = title(
        migration ? "People and homes." : "More than a rate.",
        migration ? "Check the local balance." : "Compare the whole loan."
      );
      nodes.push(
        rule("finish", 295),
        at(
          0,
          370,
          text(
            migration
              ? "Migration is one part of the housing demand story."
              : "Use the average as context. Read the terms of your own loan.",
            58,
            c.fg,
            true
          )
        ),
        at(0, 760, text("Read the evidence", 36, c.gold)),
        at(0, 830, text(`Link in bio / ${v.readLabel}`, 30, c.muted))
      );
    }
  } else throw new Error(`Unreviewed context scene: ${key}`);
  return {
    content: box({ width: 840, height: 980, position: "relative" }, nodes),
    meta: {
      kicker: migration ? "POPULATION / INTERSTATE MIGRATION" : "BORROWING / NEW HOME LOANS",
      source:
        !migration && ["claim", "facts"].includes(key)
          ? "The Desk calculation / hypothetical loan"
          : v.source,
      publisher: migration
        ? "Australian Bureau of Statistics"
        : ["claim", "facts"].includes(key)
          ? "Method / ASIC Moneysmart mortgage calculator"
          : "Reserve Bank of Australia / APRA",
      documentary: true,
      quiet: true,
      index: v.script.findIndex((s) => s.key === key),
      count: v.script.length,
      ...(!migration ? { photoCredit: REEL_SHOTS[reelSceneShot(v.recipe, key)!].credit } : {}),
    },
  };
}
