import { z } from "zod";

export const MARKET_DIMENSIONS = {
  prices: "Price momentum",
  rents: "Rental conditions",
  supply: "Housing supply",
  listings: "Listings",
  construction: "Construction pipeline",
  affordability: "Affordability",
  credit: "Lending / credit",
  population: "Migration / population",
  employment: "Employment / economic exposure",
  investors: "Investor activity",
  risks: "Major risks",
} as const;

export const marketNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} .,'’()\-]*$/u, "Enter a city, region or suburb name.")
  .transform((value) => value.replace(/\s+/g, " "));
export const comparisonInputSchema = z
  .object({ marketA: marketNameSchema, marketB: marketNameSchema })
  .refine((value) => value.marketA.toLowerCase() !== value.marketB.toLowerCase(), {
    message: "Choose two different markets.",
    path: ["marketB"],
  });

const comparisonBasisSchema = z
  .object({
    measure: z.string().trim().min(1).max(100).nullable(),
    period: z.string().trim().min(1).max(100).nullable(),
    segment: z.string().trim().min(1).max(80).nullable(),
    geography: z.string().trim().min(1).max(80).nullable(),
    unit: z.string().trim().min(1).max(40).nullable(),
  })
  .strict();

const observationSchema = z
  .object({
    sourceRef: z.number().int().positive().max(8),
    quote: z.string().min(12).max(360),
    // Optional only so existing signed snapshots remain readable. New answers
    // explicitly record a basis, using null for each unsupported criterion.
    basis: comparisonBasisSchema.nullable().optional(),
  })
  .strict();
const comparisonRowSchema = z
  .object({
    dimension: z.enum(
      Object.keys(MARKET_DIMENSIONS) as [
        keyof typeof MARKET_DIMENSIONS,
        ...Array<keyof typeof MARKET_DIMENSIONS>,
      ]
    ),
    marketA: observationSchema.nullable(),
    marketB: observationSchema.nullable(),
    read: z.string().min(1).max(340),
    edge: z.enum(["a", "b", "unclear"]),
  })
  .strict();
export const comparisonAnswerSchema = z
  .object({
    verdict: z.string().min(1).max(220),
    deskTake: z.string().min(1).max(640),
    whatWouldChangeTheCall: z.string().min(1).max(520),
    confidence: z.enum(["low", "medium", "high"]),
    rows: z.array(comparisonRowSchema).max(11),
  })
  .strict();

export const comparisonSnapshotSchema = comparisonAnswerSchema
  .extend({
    marketA: marketNameSchema,
    marketB: marketNameSchema,
    asOf: z.string(),
    sources: z
      .array(
        z
          .object({
            ref: z.number().int().positive().max(8),
            title: z.string().max(240),
            date: z.string().max(32),
            publisher: z.string().max(120).nullable(),
            href: z
              .string()
              .regex(/^\/(?!\/)/)
              .max(180),
            markets: z
              .array(z.enum(["a", "b"]))
              .min(1)
              .max(2),
          })
          .strict()
      )
      .min(1)
      .max(8),
  })
  .strict();

export type MarketComparison = z.infer<typeof comparisonSnapshotSchema>;
export type ComparisonRow = z.infer<typeof comparisonRowSchema>;
export type ComparisonSource = MarketComparison["sources"][number];
export type MarketSide = "a" | "b";
