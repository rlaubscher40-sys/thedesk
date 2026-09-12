import type { EvidenceRecipe, EvidenceVisualInput } from "./evidenceVisual";

export type ReelOpening = { headline: string; detail: string; voice: string };
const count = (n: number) => Math.abs(n).toLocaleString("en-AU");

/** One evidence-derived opening for narration, cover, first scene and caption.
 * The source adapters call this before sealing the picture/script binding. */
export function evidenceOpening(
  recipe: EvidenceRecipe,
  rows: EvidenceVisualInput["rows"]
): ReelOpening {
  const a = rows[0]!,
    b = rows[1];
  switch (recipe) {
    case "new-loan-rates":
      return {
        headline: "Five fewer years.",
        detail: "What happens to loan repayments?",
        voice: "Same loan. Five fewer years.",
      };
    case "interstate-migration": {
      const result = a.value > 0 ? "gain" : a.value < 0 ? "loss" : "change";
      return {
        headline: a.value === 0 ? "No net change." : `${count(a.value)} net ${result}.`,
        detail: "Queensland / interstate migration",
        voice:
          a.value === 0
            ? "Queensland's interstate arrivals matched its departures."
            : `Queensland's net interstate ${result}: ${count(a.value)} people.`,
      };
    }
    case "rent-comparison": {
      const tied = a.value === b!.value;
      const city = a.value > b!.value ? a.label : b!.label;
      return {
        headline: tied ? "Two cities. Same rate." : `${city}'s rate is higher.`,
        detail: "Annual rent change / not dollar rents",
        voice: tied
          ? "Brisbane and Perth have the same rent-change rate. But are rents equal?"
          : `${city}'s annual rent change is higher. But is rent dearer?`,
      };
    }
    case "capital-rents": {
      const low = Math.min(...rows.map((r) => r.value));
      const high = Math.max(...rows.map((r) => r.value));
      return {
        headline:
          low === high
            ? `${low.toFixed(1)}% in every capital.`
            : `${low.toFixed(1)}% to ${high.toFixed(1)}%.`,
        detail: "Annual rent changes / eight capitals",
        voice:
          low === high
            ? `All eight capitals recorded ${low.toFixed(1)} percent annual rent change.`
            : `Annual rent changes range from ${low.toFixed(1)} to ${high.toFixed(1)} percent across our capitals.`,
      };
    }
    case "rent-change": {
      const direction = b!.value > a.value ? "higher" : b!.value < a.value ? "lower" : "unchanged";
      return {
        headline: `Sydney's rate is ${direction}.`,
        detail: "The annual rate / not this month's rent",
        voice: `Sydney's annual rent-change rate is ${direction}. What does that mean for rents?`,
      };
    }
    case "approval-comparison":
      return {
        headline: "Approved. Not built.",
        detail: "Brisbane and Perth / dwelling approvals",
        voice: "Brisbane and Perth's approvals count permission, not completed homes.",
      };
    case "supply-checklist":
      return {
        headline: `${count(a.value)} approvals.`,
        detail: "Greater Sydney / when will homes be ready?",
        voice: "Sydney's dwelling approvals don't tell you when homes will be ready.",
      };
    default:
      throw new Error(`Unreviewed Reel opening: ${recipe}`);
  }
}

export function housingOpening(
  shortfall: number,
  opening: "question" | "consequence"
): ReelOpening {
  return opening === "consequence"
    ? {
        headline: "9 years to 11.2.",
        detail: "Modelled deposit-saving time / 2015 to 2025",
        voice: "The estimated time to save a deposit rose from nine years to eleven point two.",
      }
    : {
        headline: `About ${count(shortfall)} homes short.`,
        detail: "New supply fell behind estimated new need",
        voice: `Australia added homes, but fell about ${count(shortfall)} short of new housing need.`,
      };
}
