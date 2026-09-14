import type { DocumentarySeries, DocumentarySourceId } from "../../shared/documentaryReels";
import { DOCUMENTARY_LAUNCH_EPISODES } from "./documentaryLaunchEpisodes";

type DocumentaryScene = {
  key: string;
  chapter: string;
  headline: string;
  detail: string;
  phrases: string[];
  sources: DocumentarySourceId[];
  /** Analysis is explicitly labelled on screen, never passed off as a source quotation. */
  analysis?: boolean;
  comparison?: [{ title: string; detail: string }, { title: string; detail: string }];
};
export type DocumentaryEpisode = {
  id: string;
  series: DocumentarySeries;
  recipe: "grollo-documentary" | "meriton-documentary";
  releaseDate: string;
  period: string;
  treatment?: "person-led-v2" | "series-led-v1";
  scenes: DocumentaryScene[];
};

/** Authored, sourced scripts. No generative model or runtime article scraping in publication. */
export const DOCUMENTARY_EPISODES: DocumentaryEpisode[] = [
  ...DOCUMENTARY_LAUNCH_EPISODES,
  {
    id: "triguboff-apartments",
    series: "Property Empires",
    recipe: "meriton-documentary",
    releaseDate: "2026-09-27",
    period: "Harry Triguboff / 1933\u20132026 / AUD",
    treatment: "person-led-v2",
    scenes: [
      {
        key: "label",
        chapter: "HARRY TRIGUBOFF",
        headline: "The man who built Meriton.",
        detail: "A person before a property empire",
        phrases: [
          "This is Harry Triguboff. He built Meriton. But the road to the towers ran through a thirty million Australian dollar debt crisis.",
          "Born in Dalian to Russian Jewish parents, he grew up in Tianjin. In nineteen forty-eight, Harry and his brother came to Sydney.",
        ],
        sources: ["triguboffInterview", "meritonFounder", "triguboffHome"],
      },
      {
        key: "value",
        chapter: "FINDING THE BUSINESS",
        headline: "Textiles. Taxis. Then apartments.",
        detail: "Early work / Roseville / Tempe",
        phrases: [
          "Textiles took him to Leeds, Israel and South Africa. Back in Australia: taxis. A milk round. Then problems with his Roseville builder. Harry took over and finished the house.",
          "Then, in nineteen sixty-three, land in Tempe cost the equivalent of six thousand eight hundred Australian dollars. Eight flats sold within eight months for fifty-one thousand Australian dollars, before building and other costs.",
        ],
        sources: [
          "triguboffInterview",
          "triguboffHome",
          "meritonTempe",
          "australianDecimalConversion",
        ],
      },
      {
        key: "line",
        chapter: "A BUSINESS TAKES SHAPE",
        headline: "Bigger blocks. A different sale.",
        detail: "Gladesville / individual sales / private ownership",
        phrases: [
          "Eighteen apartments followed on Meriton Street in Gladesville. The street gave the company its name. Harry shifted from selling whole blocks to individual apartments.",
          "Meriton floated in nineteen sixty-nine. Four years later, Harry bought it back. Then the property market crashed.",
        ],
        sources: ["meritonTempe", "triguboffSpeech", "triguboffHome", "triguboffInterview"],
      },
      {
        key: "turn",
        chapter: "SURVIVAL AND EXPANSION",
        headline: "The debt. Then a new market.",
        detail: "1974\u201376 / Queensland in the 1980s",
        phrases: [
          "The business had grown. Now it had to survive. Domain reports thirty million Australian dollars of debt in the nineteen seventy-four and seventy-five downturn. Repaid by nineteen seventy-six. Harry also held apartments for rent.",
          "By the nineteen eighties, Meriton was building on the Gold Coast. Florida and The Nelson came before Xanadu in the late nineteen nineties. The business had crossed state lines.",
        ],
        sources: ["triguboffHome", "triguboffInterview", "meritonQueensland"],
      },
      {
        key: "mechanism",
        chapter: "THE MISSING MIDDLE",
        headline: "Finance. Management. Major towers.",
        detail: "1989\u20131999 / the platform behind the skyline",
        phrases: [
          "A formal finance division followed in nineteen eighty-nine, and property management in nineteen ninety. Meriton could help buyers purchase apartments, then manage them.",
          "Before World Tower, Sydney already had the Regis complex: thirty-two, forty-three and thirty-six levels by nineteen ninety-nine. Two documented apartment contracts were four hundred and eleven thousand, and three hundred and fifty-three thousand Australian dollars.",
        ],
        sources: ["triguboffInterview", "meritonVendorFinance", "meritonRegis"],
      },
      {
        key: "stakes",
        chapter: "WORLD TOWER",
        headline: "The scale had changed.",
        detail: "1999\u20132004 / staged construction / serviced apartments",
        phrases: [
          "At World Square, the project surveyor describes buying two parts of the site. World Tower was completed in two thousand and four, with lower sections occupied while construction continued above.",
          "Meanwhile, in two thousand and three, Meriton launched serviced apartments. It could build apartments, sell them, retain rentals, and operate accommodation.",
        ],
        sources: ["meritonWorldTower", "meritonHistory", "triguboffSpeech"],
      },
      {
        key: "meaning",
        chapter: "CAPITAL AT SCALE",
        headline: "Buying through the downturn.",
        detail: "2009 / 2013\u201314 / acquisition and borrowing",
        phrases: [
          "During the global financial crisis, an industry profile reported a one hundred and nine million Australian dollar purchase at Victoria Park, Zetland, and eighteen hundred housing starts in one financial year.",
          "Keeping more apartments also tied up capital. Meriton borrowed again in two thousand and thirteen. By February twenty-fourteen, reported debt was around three hundred million Australian dollars.",
        ],
        sources: ["meritonGFC", "meritonBorrowing"],
      },
      {
        key: "signOff",
        chapter: "WHAT THE BUSINESS BECAME",
        headline: "Sales. Rentals. Accommodation.",
        detail: "FY2020 rents / cumulative construction checked September 2026",
        phrases: [
          "For the twenty-twenty financial year, reported group rents were four hundred and forty-seven million Australian dollars. Rental income, not profit.",
          "Eight flats became over eighty thousand apartments built, according to Meriton. Harry changed more than the skyline. He changed how he sold, financed, managed, and earned from the apartments he kept.",
        ],
        sources: ["meritonFY2020", "meritonFounder", "triguboffSpeech"],
      },
    ],
  },
];
