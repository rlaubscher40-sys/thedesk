import { HOUSING_BALANCE_SNAPSHOT, matchedHousingBalance } from "../../shared/housingBalance";

/** A reviewed, dated report extraction. No runtime model inference or scraped numbers.
 * A new annual release requires re-verifying the source and committing a new snapshot. */
export async function getHousingBalanceSnapshot() {
  return matchedHousingBalance(HOUSING_BALANCE_SNAPSHOT)
    ? structuredClone(HOUSING_BALANCE_SNAPSHOT)
    : null;
}
