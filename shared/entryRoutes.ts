import { PUBLIC_MARKETS } from "./marketDirectory";

/** Campaign arrivals only. Never redirect a story, dated dataset or arbitrary next URL. */
export function socialArrivalPath(path: string, search: string): string | null {
  const params = new URLSearchParams(search);
  if (
    path !== "/" ||
    params.get("utm_source")?.toLowerCase() !== "instagram" ||
    params.get("utm_campaign")?.toLowerCase() !== "bio"
  )
    return null;
  return `/social${search ? `?${search.replace(/^\?/, "")}` : ""}`;
}

/** A research bridge, not a geographic crosswalk. Add only inspected source labels. */
export function marketResearchBridge(query: string, state: string | null, kind: string | null) {
  if (kind !== "LGA" || state !== "QLD" || query.trim().toLowerCase() !== "townsville (c)")
    return undefined;
  return PUBLIC_MARKETS.find((market) => market.slug === "townsville")!;
}
