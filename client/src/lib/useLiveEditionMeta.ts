/**
 * Resolves "the current edition meta" for chrome that wants to display
 * an edition number / week range / dated kicker (Hero, Footer, DatePager,
 * KeyMetrics fallback header).
 *
 * Returns the newest live edition from `editions.list` when there is one.
 * Falls back to the hand-curated `editionMeta` seed only when the app is
 * in demo mode (no DATABASE_URL). In production with no editions yet,
 * returns null so callers can render an honest "no edition yet" string
 * instead of a stale "Edition 1010" header.
 */
import { editionMeta as seedEditionMeta } from "@/data/editions/2026-05-15";
import { trpc } from "@/lib/trpc";

export type LiveEditionMeta = {
  number: number;
  weekRange: string;
  /** Best-effort longer date string. Falls back to weekRange when the
   *  live edition doesn't carry a separate longDate. */
  longDate: string;
  /** True when the meta came from a real DB row (vs. seed fallback). */
  isLive: boolean;
};

export function useLiveEditionMeta(): LiveEditionMeta | null {
  const listQuery = trpc.editions.list.useQuery();
  const demoModeQuery = trpc.system.demoMode.useQuery();
  const isDemo = demoModeQuery.data?.demoMode ?? false;

  const latest = listQuery.data?.[0]; // newest-first

  if (latest) {
    return {
      number: latest.editionNumber,
      weekRange: latest.weekRange,
      longDate: latest.weekRange,
      isLive: true,
    };
  }

  if (isDemo) {
    return {
      number: seedEditionMeta.number,
      weekRange: seedEditionMeta.weekRange,
      longDate: seedEditionMeta.longDate,
      isLive: false,
    };
  }

  // Real DB but no editions yet — let the caller render an honest
  // "—" or empty state rather than seed placeholder data.
  return null;
}
