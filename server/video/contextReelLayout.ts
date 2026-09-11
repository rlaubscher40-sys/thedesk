import type { CardVariant } from "../og/instagramCards";
import { evidenceBarGeometry, type EvidenceVisual } from "./evidenceVisual";
import { moving, smooth, type MotionNode } from "./reelMotion";

const box = (style: Record<string, unknown>, children: unknown): MotionNode => ({
  type: "div",
  props: { style: { display: "flex", ...style }, children },
});
const at = (x: number, y: number, children: unknown, style: Record<string, unknown> = {}) =>
  box({ position: "absolute", left: x, top: y, width: 840 - x, ...style }, children);

/** Two reviewed context stories. Numbers stay tied to measured speech while
 * diagram actions explain the meaning, without invented dollar or flow counts. */
export function contextReelLayout(
  v: EvidenceVisual,
  key: string,
  motion: { progress: number; rates: [number, number] },
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
      const y = 260 + i * 245;
      return [
        at(0, y, text(r.label, 36, c.muted)),
        moving(
          `number-${i}`,
          at(0, y + 48, text(amount(r.value, p), 104, i ? c.fg : c.gold, true), {
            opacity: key === "value" && p === 0 ? 0 : 1,
          }),
          840,
          130
        ),
        at(0, y + 177, "", { width: 840, height: 10, backgroundColor: c.track }),
        at(evidenceBarGeometry(values, 1, 840).zero, y + 169, "", {
          width: 1,
          height: 26,
          backgroundColor: c.muted,
        }),
        moving(
          `bar-${i}`,
          at(bar.left, y + 177, "", {
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
  } else if (key === "value" || (!migration && key === "line")) {
    nodes = title(
      migration ? "The net movement." : "New home loans.",
      migration ? "Arrivals minus departures." : "Average rate per year."
    );
    nodes.push(
      ...chart(),
      at(0, 800, text(v.period, 30, c.muted)),
      at(
        0,
        870,
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
  } else if (key === "claim") {
    nodes = title(
      migration ? "A change of address." : "From rate to repayment.",
      migration ? "A different place to live." : "Three inputs matter."
    );
    const labels = migration
      ? ["Leaves one state", "Moves across a border", "Needs a home in another"]
      : ["Amount borrowed", "Interest rate", "Loan term"];
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
    nodes.push(
      at(
        0,
        890,
        text(
          migration
            ? "Conceptual flow / not a measured route"
            : "Your loan terms determine your repayments",
          28,
          c.muted
        )
      )
    );
  } else if (key === "facts") {
    nodes = title(
      migration ? "A state is not a suburb." : "Read the full cost.",
      migration ? "Look where homes are needed." : "Rate. Fees. Repayments."
    );
    nodes.push(
      reveal("check-1", 310, migration ? "Local household growth" : "Compare rates and fees"),
      rule("check-rule", 460),
      reveal(
        "check-2",
        540,
        migration ? "Vacant and completed homes" : "Check the comparison rate",
        0.5
      ),
      at(
        0,
        805,
        text(
          migration
            ? "State migration alone cannot establish a local shortage."
            : "Check what is included and the assumed loan terms.",
          40,
          c.muted
        )
      )
    );
  } else if (key === "signOff") {
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
  } else throw new Error(`Unreviewed context scene: ${key}`);
  return {
    content: box({ width: 840, height: 980, position: "relative" }, nodes),
    meta: {
      kicker: migration ? "POPULATION / INTERSTATE MIGRATION" : "BORROWING / NEW HOME LOANS",
      source: v.source,
      publisher: migration ? "Australian Bureau of Statistics" : "Reserve Bank of Australia / APRA",
      documentary: true,
      quiet: true,
      index: v.script.findIndex((s) => s.key === key),
      count: v.script.length,
    },
  };
}
