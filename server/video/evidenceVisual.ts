import { createHash } from "node:crypto";
import type { ReelStat } from "./statReel";
import type { ScriptLine } from "./narration";

export type EvidenceRecipe =
  | "new-loan-rates"
  | "interstate-migration"
  | "rent-comparison"
  | "capital-rents"
  | "rent-change"
  | "approval-comparison"
  | "supply-checklist";
export type EvidenceVisualInput = {
  recipe: EvidenceRecipe;
  period: string;
  rows: Array<{ label: string; value: number }>;
  readLabel: string;
};
export type EvidenceVisual = EvidenceVisualInput & {
  version: 1;
  source: string;
  evidenceHash: string;
  script: ScriptLine[];
  binding: string;
};
const digest = (data: unknown) => createHash("sha256").update(JSON.stringify(data)).digest("hex");

/** Called only after a source adapter has verified the observations. The seal
 * detects accidental drift between that candidate's numbers, script and visuals;
 * it does not replace source verification. Publication identity stays unchanged. */
export function withEvidenceVisual<
  T extends { stat: ReelStat; script: ScriptLine[]; evidenceHash: string },
>(candidate: T, input: EvidenceVisualInput): T {
  const visual = {
    ...structuredClone(input),
    version: 1 as const,
    source: candidate.stat.source ?? "",
    evidenceHash: candidate.evidenceHash,
    script: structuredClone(candidate.script),
  };
  const visualStory = { ...visual, binding: digest(visual) };
  validateEvidenceVisual(visualStory, candidate.script, candidate.evidenceHash);
  return { ...candidate, stat: { ...candidate.stat, visualStory } };
}

export function validateEvidenceVisual(
  visual: EvidenceVisual,
  script: ScriptLine[],
  evidenceHash = visual.evidenceHash
) {
  const { binding, ...data } = visual;
  const count = {
    "new-loan-rates": 2,
    "interstate-migration": 2,
    "rent-comparison": 2,
    "capital-rents": 8,
    "rent-change": 2,
    "approval-comparison": 2,
    "supply-checklist": 1,
  }[visual.recipe];
  if (
    visual.version !== 1 ||
    !count ||
    visual.rows.length !== count ||
    !visual.period.trim() ||
    !visual.readLabel.trim() ||
    !visual.source.trim() ||
    !/^[a-f0-9]{64}$/.test(visual.evidenceHash) ||
    evidenceHash !== visual.evidenceHash ||
    new Set(visual.rows.map((r) => r.label)).size !== count ||
    visual.rows.some((r) => !r.label.trim() || r.label.length > 35 || !Number.isFinite(r.value)) ||
    JSON.stringify(script) !== JSON.stringify(visual.script) ||
    binding !== digest(data)
  )
    throw new Error("Reel visual does not match its verified evidence and narration.");
  const counts = visual.recipe === "approval-comparison" || visual.recipe === "supply-checklist";
  const keys =
    visual.recipe === "approval-comparison"
      ? ["label", "value", "line", "construction", "completion", "facts", "claim", "signOff"]
      : ["label", "value", "line", "claim", "facts", "signOff"];
  if (JSON.stringify(script.map((s) => s.key)) !== JSON.stringify(keys))
    throw new Error("Unreviewed visual scene sequence.");
  if (
    visual.rows.some((r) =>
      counts
        ? !Number.isSafeInteger(r.value) || r.value < 0
        : visual.recipe === "interstate-migration"
          ? !Number.isSafeInteger(r.value)
          : visual.recipe === "new-loan-rates"
            ? r.value < 0 || r.value > 30
            : r.value < -100
    )
  )
    throw new Error("Invalid visual observation.");
}

/** Signed shared scale, including zero. Negative annual rates never become
 * positive bars and ties never acquire an invented visual difference. */
export function evidenceBarGeometry(values: number[], progress: number, width = 600) {
  if (
    !values.length ||
    values.some((v) => !Number.isFinite(v)) ||
    !Number.isFinite(progress) ||
    progress < 0 ||
    progress > 1
  )
    throw new Error("Invalid comparison geometry.");
  const low = Math.min(0, ...values),
    high = Math.max(0, ...values);
  const span = high - low || 1;
  const zero = (-low / span) * width;
  return {
    zero,
    bars: values.map((value) => {
      const endpoint = zero + (value / span) * width * progress;
      return { left: Math.min(zero, endpoint), width: Math.abs(endpoint - zero) };
    }),
  };
}
