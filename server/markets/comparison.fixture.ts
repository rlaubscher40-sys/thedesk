import type { z } from "zod";
import type { comparisonAnswerSchema } from "../../shared/marketComparison";
import type { MarketEvidence } from "./evidence";

// Synthetic test records. These are not production property data.
export const comparisonNow = Date.UTC(2026, 8, 7, 12);
export const comparisonEvidence: MarketEvidence[] = [
  {
    ref: 1,
    title: "Brisbane rental observation",
    date: "2026-09-01",
    publisher: "Fixture publisher A",
    href: "/story/101",
    markets: ["a"],
    text: "Brisbane house rents rose 4% over the year to August. Brisbane housing supply remains constrained.",
  },
  {
    ref: 2,
    title: "Perth rental observation",
    date: "2026-09-01",
    publisher: "Fixture publisher B",
    href: "/story/102",
    markets: ["b"],
    text: "Perth house rents rose 3% over the year to August. Perth housing supply remains constrained.",
  },
];
export const comparisonAnswer: z.infer<typeof comparisonAnswerSchema> = {
  verdict: "Brisbane has the firmer rental pulse; the wider setup remains uncertain.",
  deskTake:
    "The rental evidence leans Brisbane, but it does not establish a stronger investment outcome.",
  whatWouldChangeTheCall:
    "A reversal in comparable rental growth or a material supply response would weaken the rental call.",
  confidence: "high",
  rows: [
    {
      dimension: "rents",
      marketA: { sourceRef: 1, quote: "Brisbane house rents rose 4% over the year to August." },
      marketB: { sourceRef: 2, quote: "Perth house rents rose 3% over the year to August." },
      read: "Brisbane has the firmer recorded rental growth in this comparable period.",
      edge: "a",
    },
  ],
};
