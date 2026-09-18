import { trpc } from "@/lib/trpc";
import { StateLabourRead } from "@shared/StateLabourRead";
import { labourState } from "@shared/stateLabour";

export function MarketLabourConditions({
  market,
  period,
}: {
  market: string;
  period?: string | null;
}) {
  const state = labourState(market);
  const query = trpc.markets.stateLabour.useQuery(undefined, {
    enabled: Boolean(state),
    staleTime: 3_600_000,
  });
  if (!state) return null;
  if (query.isLoading)
    return (
      <p role="status" className="py-6">
        Loading state employment figures…
      </p>
    );
  return (
    <StateLabourRead
      data={query.data}
      stateCode={state}
      period={period}
      asOf={new Date().toISOString()}
    />
  );
}
