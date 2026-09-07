import { CityRentRead } from "@shared/CityRentRead";
import { rentCity } from "@shared/cityRents";
import { trpc } from "@/lib/trpc";

export function MarketRentConditions({ marketA, marketB }: { marketA: string; marketB?: string }) {
  const enabled = Boolean(rentCity(marketA) || (marketB && rentCity(marketB)));
  const query = trpc.markets.rentalConditions.useQuery(undefined, {
    enabled,
    staleTime: 60_000,
    retry: false,
  });
  if (!enabled) return null;
  if (query.isLoading)
    return (
      <p role="status" className="bs-label mt-6">
        Loading official rental conditions…
      </p>
    );
  return (
    <CityRentRead
      data={query.data}
      marketA={marketA}
      marketB={marketB}
      asOf={new Date().toISOString().slice(0, 10)}
    />
  );
}
