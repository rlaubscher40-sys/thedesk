import { localSourceAccessDenied } from "./localSourceAccess";
import type { LocalDataset } from "./localData";

/** Operational state is separate from source suppression of individual figures. */
export function localCoverageState(
  data: LocalDataset | undefined,
  error: string | null | undefined
) {
  return localSourceAccessDenied(error)
    ? "Access blocked"
    : error
      ? "Collection failed"
      : data
        ? "Stored release available"
        : "Not collected";
}

export function localObservationCoverage(data: LocalDataset | undefined) {
  const counts = { published: 0, notPublished: 0, insufficientSample: 0, sourceUnavailable: 0 };
  for (const area of data?.areas ?? [])
    for (const row of area.observations) {
      if (row.status === "source-unavailable") counts.sourceUnavailable++;
      else if (row.status === "suppressed") counts.notPublished++;
      else if (row.status === "insufficient-sample") counts.insufficientSample++;
      else if (row.value !== null) counts.published++;
    }
  return counts;
}
