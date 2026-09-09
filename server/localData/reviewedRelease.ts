import { readLocalDataset, writeLocalDataset } from "../db/localData";
import sa from "./releases/sa-2026-06";

export const REVIEWED_SA_JOB = "local-data-sa-reviewed-release";

/** Never replace an existing release or turn an import into a successful source check. */
export async function reviewedSaReleasePending(): Promise<boolean> {
  return (await readLocalDataset("sa-bond-rents")) === null;
}

export async function importReviewedSaRelease(): Promise<void> {
  if (!(await reviewedSaReleasePending())) return;
  await writeLocalDataset(sa);
  console.log(
    `[local-data] reviewed SA release ${sa.period} stored: ${sa.areas.length} areas; automatic source health unchanged`,
  );
}
