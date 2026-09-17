import { readDocumentaryComparisonHistory } from "../db/documentaryHistory";
import { readReelStorySource } from "../db/reelStorySource";
import { DOCUMENTARY_EPISODES, RETIRED_DOCUMENTARY_PUBLICATIONS } from "./documentaryEpisodes";
import { DOCUMENTARY_REVIEWS } from "./documentaryReviews";
import {
  DOCUMENTARY_RELEASE_DATES,
  documentaryOverlap,
  reelEditorialIdentity,
} from "./documentaryReleasePlan";
import { REEL_PUBLICATION_FAMILIES } from "./reelCandidates";
import { documentaryCandidate, documentaryLaunchReady } from "./verifiedDocumentaryReel";
import { reelPublicationRecord } from "./reelStatus";
import { approvedDocumentaryExport } from "./documentaryExports";
import { sydneySocialClock } from "../../shared/instagramSchedule";

/** Conservative authored subject/event/takeaway comparison across both programmes.
 * A repeated person is held until a sourced distinction is explicitly registered.
 * No title similarity, fame score, inferred publication, or receipt reset. */
export async function documentaryPublicationGuard(id: string, now = new Date()) {
  try {
    if (!documentaryLaunchReady())
      throw new Error("Four approved exports are required before launch.");
    const key = `instagram-reel-documentary-${id}-v1`;
    const identity = reelEditorialIdentity(key);
    const review = DOCUMENTARY_REVIEWS[id];
    if (!identity || !review) throw new Error("Unregistered documentary identity.");
    for (const publication of [
      ...DOCUMENTARY_EPISODES.map((e) => documentaryCandidate(e).publication),
      ...RETIRED_DOCUMENTARY_PUBLICATIONS.map((e) => e.publication),
    ]) {
      const receipt = await reelPublicationRecord(publication);
      if (receipt.state === "locked" || receipt.state === "unavailable")
        throw new Error(`Permanent receipt ${receipt.state}: ${publication.key}`);
      if (publication.key === key && receipt.state === "published")
        throw new Error("This documentary already has a publication receipt.");
    }
    // A damaged/missing member cannot count towards the four-film launch buffer.
    for (const episode of DOCUMENTARY_EPISODES.slice(0, 4))
      await approvedDocumentaryExport(documentaryCandidate(episode).stat.documentary!);
    const history = await readDocumentaryComparisonHistory(now);
    for (const receipt of history) {
      if (receipt.key === key)
        throw new Error("This documentary already has a publication receipt.");
      const other = reelEditorialIdentity(receipt.key);
      if (!other) throw new Error(`Unclassified recent Reel: ${receipt.key}`);
      if (documentaryOverlap(identity, other))
        throw new Error(`Recent story overlaps: ${receipt.key}`);
      const source = await readReelStorySource(receipt);
      if (source?.render?.videoSha256 === review.videoSha256)
        throw new Error("The same export was already used by another programme.");
      if (
        source?.stat.documentary &&
        receipt.key !== `instagram-reel-documentary-${source.stat.documentary.id}-v1`
      )
        throw new Error("Historical export is recorded under another programme identity.");
    }
    // All ordinary recipes remain potential fallback/upcoming inventory. Retired
    // documentaries are checked in history, never mistaken for upcoming releases.
    const today = sydneySocialClock(now).dateISO;
    const upcoming = Object.keys(REEL_PUBLICATION_FAMILIES).filter(
      (k) => !k.startsWith("instagram-reel-documentary-")
    );
    for (const episode of DOCUMENTARY_EPISODES) {
      if ((DOCUMENTARY_RELEASE_DATES[episode.id] ?? "") >= today)
        upcoming.push(documentaryCandidate(episode).publication.key);
    }
    for (const otherKey of upcoming) {
      if (otherKey === key) continue;
      const other = reelEditorialIdentity(otherKey);
      if (!other) throw new Error(`Unclassified upcoming Reel: ${otherKey}`);
      if (documentaryOverlap(identity, other))
        throw new Error(`Upcoming story overlaps: ${otherKey}`);
      const otherId = otherKey.match(/^instagram-reel-documentary-(.+)-v1$/)?.[1];
      if (otherId && DOCUMENTARY_REVIEWS[otherId]?.videoSha256 === review.videoSha256)
        throw new Error("The same export is queued more than once.");
    }
    return {
      ready: true as const,
      comparedReceipts: history.length,
      comparedUpcoming: upcoming.length - 1,
    };
  } catch (error) {
    return {
      ready: false as const,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

let lastReadiness = "";
/** Authenticated server-side read of future slots, visible in private deployment
 * logs. This neither claims a receipt nor exposes admin data to public routes. */
export async function logDocumentaryReleaseReadiness(now = new Date()) {
  const episodes = [];
  for (const episode of DOCUMENTARY_EPISODES) {
    const candidate = documentaryCandidate(episode);
    const receipt = await reelPublicationRecord(candidate.publication);
    const guard = await documentaryPublicationGuard(episode.id, now);
    let archive = "verified";
    try {
      await approvedDocumentaryExport(candidate.stat.documentary!);
    } catch (error) {
      archive = error instanceof Error ? error.message : String(error);
    }
    episodes.push({
      id: episode.id,
      date: DOCUMENTARY_RELEASE_DATES[episode.id],
      receipt,
      ready: receipt.state === "available" && guard.ready && archive === "verified",
      guard,
      archive,
    });
  }
  const summary = JSON.stringify(episodes);
  if (summary !== lastReadiness) {
    console.log(`[instagram] documentary release readiness ${summary}`);
    lastReadiness = summary;
  }
}
