import { cached } from "../core/cache";
import { fetchRbaHousingRates } from "../../scripts/ingest/lib/rbaHousingRates";

/** Share the reviewed F6 parser. One bounded attempt per hour, including failure,
 * rather than downloading another monthly table on every scheduler tick. */
export function getReelLendingRates() {
  return cached("reels:rba-f6", 3_600_000, fetchRbaHousingRates);
}
