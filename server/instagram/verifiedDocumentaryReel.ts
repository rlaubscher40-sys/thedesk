import {
  DOCUMENTARY_READING,
  DOCUMENTARY_SOURCES,
  documentaryDurationLimit,
} from "../../shared/documentaryReels";
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
    caption: [
      episode.treatment ? episode.scenes[0]!.phrases[0]! : script[0]!.text,
      "",
      `${episode.series} / ${reading.title}`,
      "",
      episode.treatment ? "The missing decades behind Meriton's growth." : reading.meaning,
      "",
      episode.treatment
        ? "AUD throughout. Early amounts aren't inflation-adjusted. Sales and rents aren't profit. Regis prices are individual contracts. Built doesn't mean still owned."
        : reading.limitation,
      "",
      "Sources:",
      ...reading.sources.map((id) => {
        const source = DOCUMENTARY_SOURCES[id];
        return "captionCitation" in source
          ? source.captionCitation
          : `${source.publisher}: ${source.title} (${source.published}).`;
      }),
      "",
      episode.treatment === "person-led-v2"
        ? ""
        : "The Desk analysis is labelled. Archival photographs show their stated dates; they are not footage of the events described.",
      `Sources and image licences: thedesk.au/social#${episode.id}`,
      "",
      "Save this story. Follow The Desk for Australian property explained.",
      "#TheDesk #AustralianProperty #PropertyHistory",
    ].join("\n"),
  };
}

/** Four finished episodes form the launch buffer; unfinished drafts never fill a slot. */
export function documentaryLaunchReady() {
  return (
    DOCUMENTARY_EPISODES.slice(0, 4).length === 4 &&
    DOCUMENTARY_EPISODES.slice(0, 4).every(documentaryEpisodeReviewed)
  );
}

function documentaryEpisodeReviewed(episode: DocumentaryEpisode) {
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
      date === episode.releaseDate
        ? documentaryCandidate(episode)
        : null,
    requirement: `${episode.series} · ${episode.releaseDate} · 6:30pm Sydney. ${ready ? "Four-episode launch buffer reviewed." : "Waiting for four complete, reviewed exports."} Each episode publishes only in its assigned day slot.`,
  }));
}
