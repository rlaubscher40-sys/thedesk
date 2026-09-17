import { trpc } from "@/lib/trpc";
import { TransferRead, CompletionRead } from "@shared/QuarterlyHousingRead";
import { transferArea } from "@shared/quarterlyHousing";
import { labourState } from "@shared/stateLabour";

export function MarketQuarterlyHousing({
  market,
  transferPeriod,
  completionPeriod,
}: {
  market: string;
  transferPeriod?: string | null;
  completionPeriod?: string | null;
}) {
  const area = transferArea(market),
    state = labourState(market);
  const transfers = trpc.markets.housingTransfers.useQuery(undefined, {
    enabled: Boolean(area),
    staleTime: 3_600_000,
  });
  const completions = trpc.markets.housingCompletions.useQuery(undefined, {
    enabled: Boolean(state),
    staleTime: 3_600_000,
  });
  const asOf = new Date().toISOString();
  return (
    <>
      {area &&
        (transfers.isLoading ? (
          <p role="status">Loading verified sales data…</p>
        ) : (
          <TransferRead data={transfers.data} area={area} period={transferPeriod} asOf={asOf} />
        ))}
      {state &&
        (completions.isLoading ? (
          <p role="status">Loading verified completions…</p>
        ) : (
          <CompletionRead
            data={completions.data}
            stateCode={state}
            period={completionPeriod}
            asOf={asOf}
          />
        ))}
    </>
  );
}
