import type { DocumentaryEpisode } from "./documentaryEpisodes";
import type { DocumentarySourceId } from "../../shared/documentaryReels";
import { DOCUMENTARY_NEW_SUBJECTS } from "./documentaryNewSubjects";

const keys = ["label", "value", "line", "turn", "mechanism", "stakes", "meaning", "signOff"];
type Beat = [string, string, string, string, string, DocumentarySourceId[], boolean?];
const scenes = (beats: Beat[]): DocumentaryEpisode["scenes"] =>
  beats.map((b, i) => ({
    key: keys[i]!,
    chapter: b[0],
    headline: b[1],
    detail: b[2],
    phrases: [b[3], b[4]],
    sources: b[5],
    ...(b[6] ? { analysis: true } : {}),
  }));

/** Distinct launch subjects; superseded scripts remain in git history. */
export const DOCUMENTARY_LAUNCH_EPISODES: DocumentaryEpisode[] = [
  DOCUMENTARY_NEW_SUBJECTS[0]!,
  {
    id: "grollo-family",
    series: "Property Empires",
    recipe: "grollo-documentary",
    releaseDate: "2026-09-20",
    period: "Grollo family / 1928–1994 / AUD",
    treatment: "series-led-v1",
    scenes: scenes([
      [
        "LUIGI GROLLO",
        "Before the skyline.",
        "A family business / 1928–1994",
        "Luigi Grollo arrived in Melbourne from Italy in nineteen twenty-eight, aged eighteen.",
        "The family enterprise that followed would be reported worth more than three hundred and fifty million Australian dollars by his death in nineteen ninety-four.",
        ["grolloBiography"],
      ],
      [
        "THE FIRST DECADE",
        "No tower. No office.",
        "Labouring across three states",
        "First came a decade of itinerant labouring, sometimes living in a tent.",
        "In nineteen forty-eight, Luigi began weekend concreting. Emma, his wife, managed the books and finances.",
        ["grolloBiography"],
      ],
      [
        "THE BUSINESS GROWS",
        "35 becomes 128.",
        "Workers / 1958 to 1963",
        "By nineteen fifty-two, there was enough work to leave his paid job.",
        "The workforce grew from thirty-five in nineteen fifty-eight to one hundred and twenty-eight in nineteen sixty-three.",
        ["grolloBiography"],
      ],
      [
        "THE SETBACK",
        "Almost lost.",
        "Reserve Bank building / Melbourne",
        "But a Reserve Bank building project nearly bankrupted the family, according to the Australian Dictionary of Biography.",
        "After a heart attack in nineteen sixty-eight, Luigi left the business to his sons.",
        ["grolloBiography"],
      ],
      [
        "BRUNO AND RINO",
        "Jobs. Numbers.",
        "Different roles / one enterprise",
        "Bruno described his role as winning and overseeing jobs. Rino handled the office and the numbers.",
        "The work expanded through swimming pools, civil engineering and concrete structures for major builders.",
        ["grolloSpeech"],
      ],
      [
        "AFTER CYCLONE TRACY",
        "400 houses.",
        "Darwin reconstruction / Bruno's recollection",
        "After Cyclone Tracy struck Darwin at Christmas nineteen seventy-four, Bruno recalled building four hundred houses.",
        "He said that work was followed by their own shopping centres and multistorey developments, alongside contracts for others.",
        ["grolloSpeech"],
      ],
      [
        "1982–1986 / RIALTO",
        "The next scale.",
        "Construction becomes ownership",
        "Rialto followed in the nineteen eighties, a project Bruno remembered as a major risk.",
        "The family's progression was not just taller buildings. It was a move from supplying labour towards developing and part-owning property.",
        ["grolloBiography", "grolloSpeech"],
        true,
      ],
      [
        "1994 / A HISTORICAL MEASURE",
        "More than A$350m.",
        "Reported company worth / not personal wealth",
        "That reported three hundred and fifty million dollars described the companies' worth, not Luigi's cash, annual profit or today's value.",
        "Behind the skyline were Emma's books, Luigi's groundwork, and two sons doing very different jobs.",
        ["grolloBiography", "grolloSpeech"],
        true,
      ],
    ]),
  },
  DOCUMENTARY_NEW_SUBJECTS[1]!,
];
