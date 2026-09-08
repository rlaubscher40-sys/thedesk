import { getCityRents } from "../markets/absRents";
import { getCityApprovals } from "../markets/absApprovals";
import { verifiedRentReel } from "./verifiedReel";
import { verifiedSupplyReel } from "./verifiedSupplyReel";
import { verifiedCapitalRentReel } from "./verifiedCapitalRentReel";

/** Both sources already have bounded requests and shared caches. */
export async function getVerifiedReelCandidates(now = new Date()) {
  const [rents, approvals] = await Promise.all([getCityRents(), getCityApprovals()]);
  return [
    verifiedRentReel(rents, now),
    verifiedSupplyReel(approvals, now),
    verifiedCapitalRentReel(rents, now),
  ].filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);
}
