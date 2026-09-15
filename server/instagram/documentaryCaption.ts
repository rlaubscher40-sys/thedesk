import { DOCUMENTARY_READING, DOCUMENTARY_SOURCES } from "../../shared/documentaryReels";
import type { DocumentaryEpisode } from "./documentaryEpisodes";
import { composeEditorialCaption } from "./editorialCaption";

/** Print copy has its own hook and payoff, not a transcription of the voiceover.
 * A new registered film must supply an evidenced caption before it can publish. */
const COPY: Record<
  (typeof DOCUMENTARY_READING)[number]["id"],
  {
    hook: string;
    story: string;
    takeaway: string;
    action: string;
  }
> = {
  "triguboff-apartments": {
    hook: "Harry Triguboff's road to Meriton's towers ran through A$30 million in debt.",
    story:
      "Harry Triguboff's story runs from eight Tempe flats to individual apartment sales, finance, property management and serviced accommodation. The towers were only part of the business.",
    takeaway:
      "The Desk's reading: how he sold, financed and managed apartments matters as much as how many he built.",
    action: "Watch how the business changed between the first flats and World Tower.",
  },
  "grollo-family": {
    hook: "Before the Grollo skyline: weekend concreting, Emma's books and a near-bankruptcy.",
    story:
      "Luigi Grollo arrived in Melbourne in 1928, aged 18. Emma managed the finances. Their sons Bruno and Rino later split the jobs and the numbers, as the family moved into larger projects and property interests.",
    takeaway:
      "The Desk's reading: the shift from supplying labour to developing and part-owning property is the thread behind the skyline.",
    action: "Watch the roles and risks behind the buildings Melbourne knows.",
  },
  "lowy-westfield": {
    hook: "Westfield's next shopping centre needed more than customers. It needed capital.",
    story:
      "Frank Lowy and John Saunders opened Blacktown in 1959, then floated Westfield in 1960. Scentre's history connects that float to the Hornsby centre, which opened in 1961.",
    takeaway:
      "The Desk's reading: expanding the business meant finding a way to fund the next centre, not just opening the first.",
    action: "Follow the funding decision behind Westfield's early expansion.",
  },
  "walker-rebuild": {
    hook: "Lang Walker sold major parts of his business twice. Neither sale was retirement.",
    story:
      "From earthmoving with his father to a listed property business, Walker's career included the 1999 Australand share sale and a 2006 Mirvac portfolio deal. Collins Square and Parramatta Square came later.",
    takeaway:
      "The Desk's reading: selling assets and ending a development career are different decisions.",
    action: "Watch what Walker sold, what he kept and what he built next.",
  },
};

export function buildDocumentaryCaption(episode: DocumentaryEpisode): string {
  const reading = DOCUMENTARY_READING.find((item) => item.id === episode.id);
  if (!reading) throw new Error("Documentary needs its public source notes.");
  const copy = COPY[reading.id];
  if (!copy) throw new Error("Documentary needs an evidenced editorial caption.");
  const references = [
    ...new Set(
      reading.sources.map((id) => {
        const source = DOCUMENTARY_SOURCES[id];
        return "captionCitation" in source
          ? source.captionCitation
          : `${source.publisher}: ${source.title} (${source.published}).`;
      })
    ),
  ];
  return composeEditorialCaption({
    hook: copy.hook,
    paragraphs: [copy.story, copy.takeaway],
    action: copy.action,
    destination: `${episode.series} · Sources and image licences: thedesk.au/social#${episode.id}`,
    notes: [
      reading.limitation,
      ...(/photographs are dated context/i.test(reading.limitation)
        ? []
        : ["Photographs are dated context, not footage of the events described."]),
      ...(episode.treatment === "series-led-v1"
        ? [
            "Adapted photographic sequences: CC BY-SA 4.0. Original image credits and licences in source notes.",
          ]
        : []),
    ],
    references: ["Sources:", ...references],
    disclosure: "AI narration.",
    beat: "history",
    hookLimit: 110,
  });
}
