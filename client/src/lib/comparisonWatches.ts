import { z } from "zod";
import { marketNameSchema } from "@shared/marketComparison";
import { comparisonPairKey } from "@shared/comparisonChanges";

export const COMPARISON_WATCH_KEY = "thedesk:comparison-watches:v1";
export const MAX_COMPARISON_WATCHES = 6;
const watchSchema = z
  .object({
    marketA: marketNameSchema,
    marketB: marketNameSchema,
    baselineToken: z.string().min(20).max(16_000),
    watchedAt: z.string().datetime(),
  })
  .strict()
  .refine((value) => value.marketA.toLowerCase() !== value.marketB.toLowerCase());
export type ComparisonWatch = z.infer<typeof watchSchema>;
export type WatchStorage = Pick<Storage, "getItem" | "setItem">;

/** Local metadata is never trusted intelligence. Only the server can verify the
 * saved token; do not decode it here or persist client-authored answer fields. */
export function parseComparisonWatches(raw: string | null): ComparisonWatch[] {
  if (!raw || raw.length > 120_000) return [];
  try {
    const values: unknown = JSON.parse(raw);
    if (!Array.isArray(values)) return [];
    const records: ComparisonWatch[] = [];
    const seen = new Set<string>();
    for (const value of values.slice(0, 100)) {
      const parsed = watchSchema.safeParse(value);
      if (!parsed.success) continue;
      const key = comparisonPairKey(parsed.data.marketA, parsed.data.marketB);
      if (seen.has(key)) continue;
      seen.add(key);
      records.push(parsed.data);
      if (records.length === MAX_COMPARISON_WATCHES) break;
    }
    return records;
  } catch {
    return [];
  }
}

export function readComparisonWatchValue(storage: WatchStorage | null): string {
  try {
    return storage?.getItem(COMPARISON_WATCH_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeComparisonWatch(
  storage: WatchStorage | null,
  watch: ComparisonWatch,
  replaceBaseline = false
): { ok: boolean; message?: string } {
  if (!storage)
    return { ok: false, message: "This browser cannot save a comparison on this device." };
  const parsed = watchSchema.safeParse(watch);
  if (!parsed.success) return { ok: false, message: "This comparison cannot be saved." };
  const records = parseComparisonWatches(readComparisonWatchValue(storage));
  const key = comparisonPairKey(watch.marketA, watch.marketB);
  const existing = records.findIndex(
    (item) => comparisonPairKey(item.marketA, item.marketB) === key
  );
  if (existing >= 0 && !replaceBaseline) return { ok: true };
  if (existing < 0 && records.length >= MAX_COMPARISON_WATCHES)
    return {
      ok: false,
      message: "Your six comparison slots are full. Remove a saved pair before adding another.",
    };
  if (existing >= 0) records[existing] = parsed.data;
  else records.unshift(parsed.data);
  try {
    storage.setItem(COMPARISON_WATCH_KEY, JSON.stringify(records));
    return { ok: true };
  } catch {
    return {
      ok: false,
      message:
        "The comparison could not be saved on this device. Your existing baseline was not replaced.",
    };
  }
}

export function removeComparisonWatch(storage: WatchStorage | null, key: string): boolean {
  if (!storage) return false;
  try {
    const records = parseComparisonWatches(storage.getItem(COMPARISON_WATCH_KEY));
    storage.setItem(
      COMPARISON_WATCH_KEY,
      JSON.stringify(
        records.filter((item) => comparisonPairKey(item.marketA, item.marketB) !== key)
      )
    );
    return true;
  } catch {
    return false;
  }
}
