import type { EvidenceVisual } from "./evidenceVisual";
import { reelSceneShot, REEL_SHOTS } from "./reelVisualStandard";
import { moving, smooth, type MotionNode } from "./reelMotion";
import { evidenceOpening } from "./reelOpening";

const box = (style: Record<string, unknown>, children: unknown): MotionNode => ({
  type: "div",
  props: { style: { display: "flex", ...style }, children },
});
const text = (value: string, size: number, gold = false, serif = false) => {
  const node = box(
    {
      width: "100%",
      fontFamily: serif ? "Playfair Display" : "Desk Editorial Sans",
      fontWeight: serif ? 700 : 400,
      fontSize: size,
      lineHeight: 1.14,
      color: gold ? "#C5A267" : "#F0EDE6",
    },
    value
  );
  node.props["data-reel-safe-text"] = true;
  return node;
};
const at = (y: number, value: string, size = 48, gold = false, serif = false) =>
  box({ position: "absolute", left: 0, top: y, width: 840 }, text(value, size, gold, serif));

/** Photo scenes leave the upper half for the subject. Dense comparisons retain
 * their authored evidence layout on a clean canvas. Neither changes narration. */
export function cinematicEvidenceLayout(v: EvidenceVisual, key: string, progress: number) {
  const shot = reelSceneShot(v.recipe, key);
  if (!shot || v.recipe === "new-loan-rates") return null;
  const supply = ["approval-comparison", "supply-checklist"].includes(v.recipe);
  const migration = v.recipe === "interstate-migration";
  const change = v.recipe === "rent-change";
  const capitals = v.recipe === "capital-rents";
  const checklist = v.recipe === "supply-checklist";
  const latest = v.rows.at(-1)!.value;
  let headline: string,
    detail: string,
    note = v.period;
  let extra: MotionNode[] = [];
  if (key === "label") {
    ({ headline, detail } = evidenceOpening(v.recipe, v.rows));
  } else if (key === "signOff") {
    [headline, detail] = migration
      ? ["People need homes.", "Check the local balance."]
      : checklist
        ? ["Stage. Place. Timing.", "Keep the three checks."]
        : supply
          ? ["Count finished homes.", "Then compare local demand."]
          : capitals
            ? ["Growth is not price.", "Compare like with like."]
            : change
              ? ["Read the annual rate.", "Then check the period."]
              : ["Growth is not yield.", "Check rent, price and costs."];
    note = "Read the evidence / link in bio";
  } else if (migration && key === "line") {
    [headline, detail] = ["Count both directions.", "Arrivals minus departures."];
    extra = [moving("net-result", at(815, "= Net interstate change", 42, true), 840, 70)];
    note = "Net change is not the total number arriving";
  } else if (migration && key === "claim") {
    [headline, detail] = ["A new address.", "A home in a different place."];
    note = "Illustration / not a measured migration route";
  } else if (migration && key === "facts") {
    [headline, detail] = ["A state is not a suburb.", "Check homes where people need them."];
    note = "State migration alone cannot establish a local shortage";
  } else if (supply && key === "construction") {
    [headline, detail] = ["Under construction.", "Building still has to happen."];
    note = "Illustrative stage / not construction-start counts";
  } else if (supply && key === "completion") {
    [headline, detail] = ["A completed home.", "Now people can move in."];
    note = "Illustrative stage / not measured completions";
  } else if (checklist && key === "line") {
    [headline, detail] = ["Approved, not finished.", "Permission comes before delivery."];
  } else if (checklist && key === "claim") {
    [headline, detail] = ["Check stage and place.", "City totals are not your suburb."];
  } else if (checklist && key === "facts") {
    [headline, detail] = ["When will homes be ready?", "The city total cannot tell you."];
  } else if (change && key === "claim") {
    [headline, detail] =
      latest > 0
        ? [
            "Rents still rose.",
            latest < v.rows[0]!.value ? "Slower is not cheaper." : "Compared with a year earlier.",
          ]
        : latest < 0
          ? ["Rents fell.", "Compared with a year earlier."]
          : ["No annual change.", "Compared with a year earlier."];
    note = `Latest annual change: ${latest.toFixed(1)}% / ${v.period}`;
  } else if (capitals && key === "claim") {
    [headline, detail] = ["Growth is a rate.", "Rent is a dollar price."];
    note = "These rates do not rank weekly dollar rents";
  } else if (v.recipe === "rent-comparison" && key === "facts") {
    [headline, detail] = ["Buying an investment?", "Check purchase price and costs."];
    note = "Rent growth alone does not measure rental yield";
  } else throw new Error(`Missing cinematic scene composition: ${v.recipe}/${key}`);
  return {
    content: box({ position: "relative", width: 840, height: 980 }, [
      at(535, headline, headline.length > 23 ? 62 : 74, false, true),
      moving(
        "scene-meaning",
        {
          ...at(735, detail, 48, true),
          props: {
            ...at(735, detail, 48, true).props,
            style: { ...at(735, detail, 48, true).props.style, opacity: smooth(progress * 2) },
          },
        },
        840,
        125
      ),
      ...extra,
      at(880, note, 28),
    ]),
    meta: {
      kicker: migration
        ? "POPULATION / INTERSTATE MIGRATION"
        : supply
          ? "HOUSING SUPPLY / APPROVALS"
          : "RENT MARKETS / ANNUAL CHANGE",
      source: v.source,
      publisher: "Australian Bureau of Statistics",
      photoCredit: REEL_SHOTS[shot].credit,
      documentary: true,
      quiet: true,
      index: v.script.findIndex((s) => s.key === key),
      count: v.script.length,
    },
  };
}
