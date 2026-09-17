import { trpc } from "@/lib/trpc";
import { CityApprovalRead } from "@shared/CityApprovalRead";
import { rentCity } from "@shared/cityRents";

/** Dated evidence links never substitute a different annual window. */
export function MarketApprovalConditions({ market, period }: { market: string; period: string }) {
  const city = rentCity(market);
  const query = trpc.markets.housingApprovals.useQuery(undefined, {
    enabled: Boolean(city), staleTime: 5 * 60_000,
  });
  if (!city) return null;
  if (query.isPending) return <p role="status">Loading the requested approvals evidence…</p>;
  return <CityApprovalRead data={query.data} cities={[city]} asOf={new Date().toISOString().slice(0, 10)} period={period} />;
}
