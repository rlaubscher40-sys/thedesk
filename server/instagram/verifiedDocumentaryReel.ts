import { DOCUMENTARY_RELEASE_DATES } from "./documentaryReleasePlan";
import { DOCUMENTARY_READING, documentaryDurationLimit } from "../../shared/documentaryReels";
import { DOCUMENTARY_EPISODES, type DocumentaryEpisode } from "./documentaryEpisodes";
import { DOCUMENTARY_REVIEWS } from "./documentaryReviews";
import {
  documentaryReviewHash,
  documentaryScript,
  sealDocumentary,
  validateDocumentary,
} from "../video/documentaryStory";
import type { ProductionReelCandidate } from "../video/reelProduction";
import { documentarySlot, sydneySocialClock } from "../../shared/instagramSchedule";
import { buildDocumentaryCaption } from "./documentaryCaption";

export function documentaryCandidate(episode: DocumentaryEpisode): ProductionReelCandidate {
  const documentary = sealDocumentary(episode);
  const script = documentaryScript(documentary);
  validateDocumentary(documentary, script);
  const reading = DOCUMENTARY_READING.find((r) => r.id === episode.id);
  if (!reading) throw new Error("Documentary needs its public source notes.");
  return {
    stat: {
      label: reading.title,
      value: episode.series,
      line: reading.meaning,
      subtext: episode.period,
      source: "Historical sources / reading notes in bio",
      documentary,
    },
    script,
    evidenceHash: documentary.evidenceHash,
    // Identity is the episode, never its voice, release slot, design or revised script.
    publication: { key: `instagram-reel-documentary-${episode.id}-v1`, date: "2026-09-14" },
    caption: buildDocumentaryCaption(episode),
  };
}

/** Four finished episodes form the launch buffer; unfinished drafts never fill a slot. */
export function documentaryLaunchReady() {
  return (
    DOCUMENTARY_EPISODES.slice(0, 4).length === 4 &&
    DOCUMENTARY_EPISODES.slice(0, 4).every(documentaryEpisodeReviewed)
  );
}

export function documentaryEpisodeReviewed(episode: DocumentaryEpisode) {
  const review = DOCUMENTARY_REVIEWS[episode.id];
  return Boolean(
    review &&
    review.hash === documentaryReviewHash(sealDocumentary(episode)) &&
    /^[a-f0-9]{64}$/.test(review.videoSha256) &&
    /^\d{4}-\d{2}-\d{2}$/.test(review.reviewedAt) &&
    review.seconds >= (episode.series === "The Deal" ? 60 : 90) &&
    review.seconds <= documentaryDurationLimit(episode.series, episode.treatment)
  );
}

export function getDocumentaryProgramme(now = new Date()) {
  const validClock = Number.isFinite(now.getTime());
  const date = validClock ? sydneySocialClock(now).dateISO : "";
  const slot = validClock ? documentarySlot(now) : null;
  const ready = documentaryLaunchReady();
  return DOCUMENTARY_EPISODES.map((episode) => ({
    topic: `${episode.series} · ${DOCUMENTARY_READING.find((r) => r.id === episode.id)!.title}`,
    family: episode.series === "The Deal" ? "documentary-deal" : "documentary-empires",
    candidate:
      ready &&
      documentaryEpisodeReviewed(episode) &&
      slot === episode.series &&
      date === DOCUMENTARY_RELEASE_DATES[episode.id]
        ? documentaryCandidate(episode)
        : null,
    requirement: `${episode.series} · ${DOCUMENTARY_RELEASE_DATES[episode.id] ?? "unscheduled"} · 6:30pm Sydney. ${ready ? "Four exact exports authorised for release." : "Waiting for four complete, reviewed exports."} Each episode publishes only in its assigned day slot.`,
  }));
}
