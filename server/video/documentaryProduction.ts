import type { DocumentaryEpisode } from "../instagram/documentaryEpisodes";
import {
  DOCUMENTARY_SOURCES,
  TRIGUBOFF_FINANCIAL_FACTS,
  type DocumentarySeries,
} from "../../shared/documentaryReels";
import { DOCUMENTARY_PHOTOS } from "../../shared/documentaryPhotos";
import { DEFAULT_SPEECH_PROFILE } from "./localVoice";
import { documentaryShotPlan } from "./documentaryShotPlan";

export const DOCUMENTARY_REVIEW_BAR = [
  {
    id: "person",
    question: "Can a new viewer identify the person and understand the opening stakes immediately?",
  },
  {
    id: "progression",
    question:
      "Does the middle explain how the business changed, including setbacks and decisions, with no unexplained leap to the skyline?",
  },
  {
    id: "evidence",
    question:
      "Does every factual and numerical claim have a checked source, period, measure and necessary qualification?",
  },
  {
    id: "money",
    question:
      "Are all money amounts AUD, with sales, costs, debt, rent, profit and wealth kept distinct and no invented reinvestment?",
  },
  {
    id: "pictures",
    question:
      "Do the images and diagrams explain the events, and are archive identity, dates and reuse rights supported?",
  },
  {
    id: "direction",
    question:
      "Does every visual change have a storytelling purpose, with enough time to read and a varied rhythm?",
  },
  {
    id: "mobile",
    question:
      "Are the face, main figures, source labels and subtitles legible and unobstructed on a phone?",
  },
  {
    id: "voice",
    question:
      "Has someone listened to the full MP4 for names, dates, AUD amounts, natural phrasing and intelligibility?",
  },
  {
    id: "sound",
    question:
      "Does the music support the stakes, stay below speech and resolve cleanly at the ending?",
  },
  {
    id: "payoff",
    question:
      "Does the ending answer the opening and leave a clear, supported understanding of the business?",
  },
] as const;

export function documentaryProductionDossier(episode: DocumentaryEpisode) {
  const ids = [...new Set(episode.scenes.flatMap((s) => s.sources))];
  const sources = Object.fromEntries(ids.map((id) => [id, DOCUMENTARY_SOURCES[id]]));
  return {
    version: 1,
    episodeId: episode.id,
    subject: episode.scenes[0]!.chapter,
    series: episode.series,
    releaseDate: episode.releaseDate,
    currency: "AUD",
    voice: DEFAULT_SPEECH_PROFILE,
    benchmark: {
      episodeId: "triguboff-apartments",
      acceptedDirection: "2026-09-14",
      videoSha256: "15a53cce4a4bc1343e21e190b576df686abf382d740238fc798edec6b5c3c266",
      meaning: "Accepted creative direction, not an automatic approval for another export.",
    },
    sources,
    // The complete catalogue is marked as such. A recipe can include other credited
    // images; its source details remain in the sequence registry and public notes.
    archiveCatalogue: DOCUMENTARY_PHOTOS,
    referenceFinancialFacts: episode.treatment ? TRIGUBOFF_FINANCIAL_FACTS : null,
    shotPlan: documentaryShotPlan(episode),
    manualReview: DOCUMENTARY_REVIEW_BAR.map((criterion) => ({
      ...criterion,
      verdict: "pending",
      evidence: "",
    })),
    published: false,
  };
}

/** Research-first scaffold. Unfilled evidence cannot become a publishable episode. */
export function newDocumentaryBrief(id: string, subject: string, series: DocumentarySeries) {
  if (
    !/^[a-z][a-z0-9-]{2,63}$/.test(id) ||
    !subject.trim() ||
    subject.length > 120 ||
    !["The Deal", "Property Empires"].includes(series)
  )
    throw new Error("Invalid documentary brief.");
  return {
    version: 1,
    id,
    subject: subject.trim(),
    series,
    status: "research-required",
    currency: "AUD",
    voice: DEFAULT_SPEECH_PROFILE,
    releaseDate: null,
    audienceQuestion: null,
    openingPersonIntroduction: null,
    closingPayoff: null,
    turningPoints: [
      "Origins and early work",
      "First verifiable project",
      "How the model changed",
      "Setback and response",
      "Expansion and later economics",
    ].map((purpose) => ({
      purpose,
      period: null,
      event: null,
      decision: null,
      consequence: null,
      sourceIds: [],
      visualAction: null,
      unknowns: [],
    })),
    claims: [],
    claimSchema: {
      id: "unique claim ID",
      statement: "exact claim to communicate",
      sourceIds: "checked source IDs",
      amountAud: "number or null",
      measure: "land cost / gross sale / debt / rent / profit / other",
      period: "date or financial year",
      qualification: "scope, uncertainty or conversion basis",
      checkedAt: "date the supporting source was read",
    },
    sources: [],
    assets: [],
    manualReview: DOCUMENTARY_REVIEW_BAR.map((c) => ({ ...c, verdict: "pending", evidence: "" })),
  };
}
