import { rentComparisonLayout } from "./rentComparisonLayout";
import type { CardVariant } from "../og/instagramCards";
import { evidenceBarGeometry, type EvidenceVisual } from "./evidenceVisual";
import { moving, smooth, type MotionNode } from "./reelMotion";

const box = (style: Record<string, unknown>, children: unknown): MotionNode => ({
  type: "div",
  props: { style: { display: "flex", ...style }, children },
});
const at = (left: number, top: number, children: unknown, style: Record<string, unknown> = {}) =>
  box({ position: "absolute", left, top, width: 840 - left, ...style }, children);
export function evidenceVisualLayout(
  v: EvidenceVisual,
  key: string,
  progress: number,
  variant: CardVariant
) {
  if (v.recipe === "rent-comparison")
    return rentComparisonLayout(
      v,
      key,
      { progress, rates: [smooth(progress * 2), smooth(progress * 2 - 1)] },
      variant
    );
  const c =
    variant === "light"
      ? { fg: "#171B21", muted: "#66635C", gold: "#946C29", track: "#DED8CD" }
      : { fg: "#F0EDE6", muted: "#A4A29C", gold: "#C5A267", track: "#30363C" };
  const type = (s: string, size = 44, colour = c.fg, face = "sans", maxHeight?: number) => {
    const node = box(
      {
        width: "100%",
        fontFamily:
          face === "serif"
            ? "Playfair Display"
            : face === "italic"
              ? "Desk Editorial Italic"
              : "Desk Editorial Sans",
        fontWeight: face === "serif" ? 700 : face === "italic" ? 500 : 400,
        fontStyle: face === "italic" ? "italic" : "normal",
        fontSize: size,
        color: colour,
        lineHeight: 1.18,
      },
      s
    );
    node.props["data-reel-safe-text"] = true;
    if (maxHeight) node.props["data-reel-max-height"] = maxHeight;
    return node;
  };
  const tag = (s: string) => type(s, 26, c.muted);
  const heading = (a: string, b: string) => [
    at(0, 0, type(a, a.length > 19 ? 76 : 90, c.fg, "serif", 110)),
    at(0, 125, type(b, 66, c.gold, "italic", 100)),
  ];
  const rule = (id: string, y: number, p = progress) =>
    moving(
      id,
      at(0, y, "", { width: 840 * smooth(p), height: 3, backgroundColor: c.gold }),
      840,
      3,
      "rect"
    );
  const reveal = (id: string, y: number, text: string, order = 0) =>
    moving(id, at(0, y, type(text, 48), { opacity: smooth(progress * 3 - order) }), 840, 125);
  const counts = v.recipe === "approval-comparison" || v.recipe === "supply-checklist";
  const change = v.recipe === "rent-change";
  const capitals = v.recipe === "capital-rents";
  const supplyCheck = v.recipe === "supply-checklist";
  const values = v.rows.map((r) => r.value);
  const spread = Math.max(...values) - Math.min(...values);
  const last = values.at(-1)!;
  const slowerPositive = change && last > 0 && last < values[0]!;
  let nodes: MotionNode[] = [];

  const chart = (animate: boolean) => {
    const p = animate ? smooth(progress) : 1;
    const geometry = evidenceBarGeometry(values, p);
    return v.rows.flatMap((row, i) => {
      const y = (capitals ? 240 : 320) + i * (capitals ? 82 : 220);
      const amount = counts
        ? Math.round(row.value * p).toLocaleString("en-AU")
        : `${(row.value * p).toFixed(1)}%`;
      const bar = geometry.bars[i]!;
      return [
        at(0, y, type(row.label, capitals ? 32 : 38, c.muted), { width: 570 }),
        moving(
          `value-${i}`,
          at(620, y - (capitals ? 6 : 15), type(amount, capitals ? 45 : 65, c.fg, "serif"), {
            width: 220,
            justifyContent: "flex-end",
            textAlign: "right",
          }),
          220,
          95
        ),
        at(0, y + 52, "", { width: 600, height: 12, backgroundColor: c.track }),
        moving(
          `bar-${i}`,
          at(bar.left, y + 52, "", {
            width: bar.width,
            height: 12,
            backgroundColor: i % 2 === 0 ? c.gold : c.fg,
          }),
          600,
          12,
          "rect"
        ),
        at(geometry.zero, y + 47, "", { width: 1, height: 22, backgroundColor: c.muted }),
      ];
    });
  };
  const process = (active: number) => [
    ...heading("Approval is a start.", "Delivery comes later."),
    ...["Permission to build", "Under construction", "Completed home"].flatMap((label, i) => [
      at(80, 340 + i * 170, type(label, 48, i === active ? c.fg : c.muted)),
      moving(
        `stage-${i}`,
        at(0, 353 + i * 170, "", {
          width: 32,
          height: 32,
          backgroundColor: i <= active ? c.gold : c.track,
          opacity: i === active ? 0.4 + 0.6 * smooth(progress) : 1,
        }),
        32,
        32,
        "rect"
      ),
      ...(i < 2
        ? [at(15, 405 + i * 170, "", { width: 2, height: 95, backgroundColor: c.track })]
        : []),
    ]),
    at(0, 910, tag("BUILDING STAGES / NOT COMPLETION COUNTS")),
  ];

  if (key === "label") {
    nodes = counts
      ? heading(
          supplyCheck ? "Buying in Sydney?" : "More approvals.",
          supplyCheck ? "Read the supply signal." : "Enough new homes?"
        )
      : heading(
          change ? "Sydney rents." : capitals ? "Eight capitals." : "Brisbane or Perth?",
          change
            ? "What actually changed?"
            : capitals
              ? "Different rent markets."
              : "Where did rents move?"
        );
    nodes.push(
      rule("opening-rule", 320),
      at(
        0,
        390,
        type(
          counts
            ? "Permission, construction and completed homes measure different things."
            : "A rent growth figure tells you how rents changed. It does not tell you what a home costs to rent.",
          48
        )
      ),
      at(0, 760, tag(v.period)),
      at(
        0,
        850,
        tag(counts ? "ORIGINAL DWELLING APPROVALS" : "RENTS ACTUALLY PAID / ANNUAL CHANGE")
      )
    );
  } else if (key === "value" || (!counts && key === "line")) {
    nodes = heading(
      counts
        ? "Permission to build."
        : change
          ? "The annual rate."
          : capitals
            ? "A spread of rates."
            : "The rent growth gap.",
      counts
        ? "Not completed homes."
        : change
          ? "Previous to latest."
          : `${spread.toFixed(1)} percentage points.`
    );
    nodes.push(
      ...chart(key === "value"),
      at(
        0,
        940,
        tag(
          counts
            ? "SAME 12 MONTHS / NOT POPULATION-ADJUSTED"
            : change
              ? "TWO ANNUAL RATES / NOT MONTHLY INFLATION"
              : "SHARED SCALE / ZERO INCLUDED"
        )
      )
    );
  } else if (counts && ["line", "construction", "completion"].includes(key)) {
    nodes = process(key === "construction" ? 1 : key === "completion" ? 2 : 0);
  } else if (!counts && key === "claim") {
    if (change) {
      nodes = heading(
        last > 0 ? "Rents still rose." : last < 0 ? "Rents fell." : "No annual change.",
        slowerPositive ? "Slower is not cheaper." : "Against a year earlier."
      );
      nodes.push(
        at(0, 340, type(`${last.toFixed(1)}%`, 170, c.gold, "serif")),
        rule("meaning-rule", 590),
        at(
          0,
          650,
          type("The latest annual rate compares rents with the same month a year earlier.", 48)
        )
      );
    } else {
      nodes = heading("Growth is a rate.", "Rent is a price.");
      nodes.push(
        at(0, 335, type("%", 150, c.gold, "serif"), { width: 180 }),
        at(240, 375, type("How fast rents changed", 48), { width: 600 }),
        rule("meaning-rule", 545),
        at(0, 620, type("$", 150, c.fg, "serif"), { width: 180 }),
        at(240, 660, type("What rent costs", 48), { width: 600 })
      );
    }
  } else if (key === "claim" || key === "facts") {
    if (counts) {
      nodes = heading(
        supplyCheck ? "Stage. Place. Timing." : "The real supply test.",
        supplyCheck ? "Check all three." : "Delivery versus need."
      );
      nodes.push(
        reveal(
          "point-0",
          345,
          supplyCheck ? "What building stage is counted?" : "How many homes are finished?"
        ),
        reveal(
          "point-1",
          535,
          supplyCheck ? "Which local area does it cover?" : "How many extra homes are needed?",
          1
        ),
        reveal(
          "point-2",
          725,
          supplyCheck ? "When could people move in?" : "Match the same area and period.",
          2
        )
      );
    } else if (change) {
      nodes = heading("Check the period.", "Two rates, two years.");
      nodes.push(
        reveal("point-0", 345, "Each rate compares with a year earlier."),
        reveal("point-1", 535, "Their difference is not monthly inflation.", 1),
        reveal("point-2", 725, "Check the monthly change separately.", 2)
      );
    } else {
      nodes = heading(
        capitals ? "Higher growth." : "Check the return.",
        capitals ? "Not higher dollar rent." : "Check more than rent."
      );
      nodes.push(
        reveal(
          "point-0",
          345,
          capitals ? "Growth measures a change over time." : "Purchase price matters."
        ),
        reveal(
          "point-1",
          535,
          capitals ? "Dollar rent measures the price level." : "Ownership costs matter.",
          1
        ),
        reveal(
          "point-2",
          725,
          capitals ? "They answer different questions." : "Rent growth is not rental yield.",
          2
        )
      );
    }
  } else if (key === "signOff") {
    nodes = counts
      ? heading(
          supplyCheck ? "Stage. Place. Timing." : "Count finished homes.",
          supplyCheck ? "Keep the checklist." : "Then compare demand."
        )
      : heading(
          change && slowerPositive
            ? "Slower growth."
            : capitals
              ? "Compare like with like."
              : change
                ? "Read the annual rate."
                : "Growth is not yield.",
          change && slowerPositive
            ? "Rents can still rise."
            : capitals
              ? "Growth and price differ."
              : change
                ? "Then check the period."
                : "Check price and costs."
        );
    nodes.push(
      rule("takeaway-rule", 360),
      at(
        0,
        460,
        type(
          counts
            ? "An approval count alone cannot tell you whether there will be enough homes."
            : change
              ? "Read the definition before drawing a conclusion from the headline."
              : "Use the right measure for the decision you are making.",
          48
        )
      ),
      at(0, 810, type("Read the evidence", 38, c.gold)),
      at(0, 875, type(`Link in bio / ${v.readLabel}`, 30, c.muted))
    );
  } else throw new Error(`Missing visual scene: ${key}`);

  return {
    content: box({ width: 840, height: 980, position: "relative" }, nodes),
    meta: {
      kicker: counts ? "HOUSING SUPPLY / APPROVALS" : "RENT MARKETS / ANNUAL CHANGE",
      source: v.source,
      publisher: "Australian Bureau of Statistics",
      documentary: true,
      quiet: true,
      index: v.script.findIndex((s) => s.key === key),
      count: v.script.length,
    },
  };
}
