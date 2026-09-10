import { readLocalDataset, writeLocalDataset } from "../db/localData";
import vic from "./releases/vic-2025-09";
import sa from "./releases/sa-2026-06";

export const REVIEWED_SA_JOB = "local-data-sa-reviewed-release";

/** Never replace an existing release or turn an import into a successful source check. */
export async function reviewedSaReleasePending(): Promise<boolean> {
  return (await readLocalDataset("sa-bond-rents")) === null;
}

export async function importReviewedSaRelease(): Promise<void> {
  if (!(await reviewedSaReleasePending())) return;
  await writeLocalDataset(sa, { onlyIfMissing: true });
  console.log(
    `[local-data] reviewed SA release ${sa.period} stored: ${sa.areas.length} areas; automatic source health unchanged`,
  );
}

export const REVIEWED_VIC_JOB = "local-data-vic-reviewed-release";
export async function reviewedVicReleasePending(): Promise<boolean> {
  return (await readLocalDataset("vic-bond-rents")) === null;
}
export async function importReviewedVicRelease(): Promise<void> {
  if (!(await reviewedVicReleasePending())) return;
  await writeLocalDataset(vic, { onlyIfMissing: true });
  console.log(`[local-data] reviewed VIC release ${vic.period} stored: ${vic.areas.length} councils; automatic source health unchanged`);
}
