import type { DocumentarySeries, DocumentarySourceId } from "../../shared/documentaryReels";

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
  treatment?: "person-led-v2";
  scenes: DocumentaryScene[];
};

/** Authored, sourced scripts. No generative model or runtime article scraping in publication. */
export const DOCUMENTARY_EPISODES: DocumentaryEpisode[] = [
  {
    id: "grollo-ownership",
    series: "The Deal",
    recipe: "grollo-documentary",
    releaseDate: "2026-09-16",
    period: "Grollo / historical business model",
    scenes: [
      {
        key: "label",
        chapter: "THE QUESTION",
        headline: "Build it. Then own a share.",
        detail: "The Grollo move",
        phrases: [
          "The Grollos helped build Melbourne's skyline.",
          "But building a tower and owning part of it are different businesses.",
        ],
        sources: ["grolloBiography"],
        analysis: true,
      },
      {
        key: "value",
        chapter: "THE START",
        headline: "A weekend business.",
        detail: "Luigi and Emma / 1948",
        phrases: [
          "Luigi Grollo started weekend concreting in nineteen forty-eight.",
          "Emma managed the books and finances.",
        ],
        sources: ["grolloBiography"],
      },
      {
        key: "line",
        chapter: "THE TURN",
        headline: "The sons take over.",
        detail: "A growing interest in part-ownership",
        phrases: [
          "After Luigi stepped back in nineteen sixty-eight, his sons increasingly sought part-ownership of buildings they constructed.",
        ],
        sources: ["grolloBiography"],
      },
      {
        key: "turn",
        chapter: "THE DECISION",
        headline: "A stake beyond the build.",
        detail: "A shift recorded in the biography",
        phrases: [
          "That distinction is the story here.",
          "There is no single deal price or ownership percentage in this account.",
        ],
        sources: ["grolloBiography"],
        analysis: true,
      },
      {
        key: "mechanism",
        chapter: "HOW IT WORKS",
        headline: "Contract. Ownership.",
        detail: "Two roles in the same project",
        comparison: [
          { title: "CONTRACTOR", detail: "Delivers the build" },
          { title: "OWNER", detail: "Holds an interest" },
        ],
        phrases: [
          "A contractor delivers work for an agreed payment.",
          "An owner keeps an interest in what happens to the property after construction.",
        ],
        sources: ["grolloBiography"],
        analysis: true,
      },
      {
        key: "stakes",
        chapter: "WHAT IS AT STAKE",
        headline: "The commitment continues.",
        detail: "Finishing the build is one milestone",
        phrases: [
          "Ownership leaves a business exposed to what comes next.",
          "A finished building still needs customers, maintenance and money to operate.",
        ],
        sources: ["grolloBiography"],
        analysis: true,
      },
      {
        key: "meaning",
        chapter: "WHY IT MATTERS",
        headline: "Read the role behind the skyline.",
        detail: "A building can have several businesses behind it",
        phrases: [
          "A famous project name can hide that distinction.",
          "Developer, builder and owner may have different responsibilities and different outcomes.",
        ],
        sources: ["grolloSpeech"],
        analysis: true,
      },
      {
        key: "signOff",
        chapter: "THE TAKEAWAY",
        headline: "Who builds? Who owns?",
        detail: "Read the sources / link in bio",
        phrases: [
          "When you hear a property success story, ask who built it, who owned it, and who carried the risk.",
        ],
        sources: ["grolloBiography"],
        analysis: true,
      },
    ],
  },
  {
    id: "grollo-family",
    series: "Property Empires",
    recipe: "grollo-documentary",
    releaseDate: "2026-09-20",
    period: "Grollo / origins and the skyline years",
    scenes: [
      {
        key: "label",
        chapter: "BEHIND THE SKYLINE",
        headline: "Before the towers, a family.",
        detail: "Luigi. Emma. Bruno. Rino.",
        phrases: [
          "Before the Grollo name reached Melbourne's skyline, it belonged to a family building a business together.",
        ],
        sources: ["grolloBiography"],
      },
      {
        key: "value",
        chapter: "THE ARRIVAL",
        headline: "Melbourne, 1928.",
        detail: "Luigi Grollo arrives from Italy",
        phrases: [
          "Luigi arrived from Italy in nineteen twenty-eight.",
          "His early Australian years involved moving between labouring jobs, long before the landmark towers.",
        ],
        sources: ["grolloBiography"],
      },
      {
        key: "line",
        chapter: "THE PARTNERSHIP",
        headline: "The work. The books.",
        detail: "A family enterprise takes shape",
        phrases: [
          "Emma handled the finances of the small business.",
          "It is an easy role to leave out of a skyline story, but a building company also has to function as a business.",
        ],
        sources: ["grolloBiography"],
        analysis: true,
      },
      {
        key: "turn",
        chapter: "THE NEXT GENERATION",
        headline: "Two brothers. Different roles.",
        detail: "Bruno: projects / Rino: numbers",
        phrases: [
          "In his own account, Bruno describes winning and overseeing jobs, while Rino looked after the numbers and the office.",
          "Their work expanded through pools, civil projects and concrete structures.",
        ],
        sources: ["grolloSpeech"],
      },
      {
        key: "mechanism",
        chapter: "THE EXPANSION",
        headline: "Beyond the construction contract.",
        detail: "Developing projects of their own",
        comparison: [
          { title: "CONSTRUCTION", detail: "Work for clients" },
          { title: "DEVELOPMENT", detail: "Projects of their own" },
        ],
        phrases: [
          "Bruno recalls rebuilding houses in Darwin after Cyclone Tracy, then developing shopping centres and multistorey buildings.",
          "They also continued construction work for other developers.",
        ],
        sources: ["grolloSpeech"],
      },
      {
        key: "stakes",
        chapter: "THE BIG BET",
        headline: "Rialto enters the story.",
        detail: "Ambition, capital and delivery",
        phrases: [
          "An earlier project, the Reserve Bank building, nearly bankrupted the family, according to the biography. Bruno later described the Rialto development as a huge risk.",
          "The later photograph shows the completed tower. Its place in the skyline can make the uncertainty before it was finished easy to forget.",
        ],
        sources: ["grolloBiography", "grolloSpeech"],
        analysis: true,
      },
      {
        key: "meaning",
        chapter: "WHY IT MATTERS",
        headline: "Several skills, one enterprise.",
        detail: "Delivery / finance / ownership",
        phrases: [
          "Our reading is that this chapter brings several different tasks into view: winning work, managing money, delivering buildings and holding property interests.",
          "A skyline photograph cannot explain those tasks on its own.",
        ],
        sources: ["grolloBiography", "grolloSpeech"],
        analysis: true,
      },
      {
        key: "signOff",
        chapter: "THE TAKEAWAY",
        headline: "Look behind the family name.",
        detail: "Historical chapter / sources in bio",
        phrases: [
          "Look behind the family name: who did the work, who managed the money, and how did the business change?",
          "Read the sources in our bio.",
        ],
        sources: ["grolloBiography", "grolloSpeech"],
        analysis: true,
      },
    ],
  },
  {
    id: "meriton-accommodation",
    series: "The Deal",
    recipe: "meriton-documentary",
    releaseDate: "2026-09-23",
    period: "Meriton / accommodation launch, 2003",
    scenes: [
      {
        key: "label",
        chapter: "THE QUESTION",
        headline: "An apartment. A different customer.",
        detail: "Meriton's accommodation business",
        phrases: [
          "Meriton built an apartment business.",
          "Then it added another kind of customer: the guest booking a stay.",
        ],
        sources: ["meritonHistory"],
      },
      {
        key: "value",
        chapter: "THE MILESTONE",
        headline: "2003",
        detail: "Meriton Serviced Apartments launches",
        phrases: [
          "The company's history dates the launch of Meriton Serviced Apartments to two thousand and three.",
        ],
        sources: ["meritonHistory"],
      },
      {
        key: "line",
        chapter: "THE COMPANY ACCOUNT",
        headline: "Space to stay.",
        detail: "Self-contained accommodation",
        phrases: [
          "Meriton says Harry Triguboff saw an opening for luxury, self-contained accommodation.",
          "That explanation comes from the company itself.",
        ],
        sources: ["meritonHistory"],
      },
      {
        key: "turn",
        chapter: "THE DECISION",
        headline: "Add an accommodation operation.",
        detail: "Development meets hospitality",
        phrases: [
          "The interesting change is the operating model.",
          "Alongside developing apartments, there is a business serving people who book accommodation.",
        ],
        sources: ["meritonHistory"],
        analysis: true,
      },
      {
        key: "mechanism",
        chapter: "HOW IT WORKS",
        headline: "Buyer. Guest.",
        detail: "A different relationship with the space",
        comparison: [
          { title: "BUYER", detail: "Purchases an interest" },
          { title: "GUEST", detail: "Pays for a stay" },
        ],
        phrases: [
          "A buyer purchases a property interest.",
          "A guest pays for a stay, so bookings and the experience during that stay become part of the business.",
        ],
        sources: ["meritonHistory"],
        analysis: true,
      },
      {
        key: "stakes",
        chapter: "THE WORK CONTINUES",
        headline: "The building is only the start.",
        detail: "Bookings / service / maintenance",
        phrases: [
          "Accommodation brings ongoing work: taking bookings, looking after guests and maintaining the property.",
          "The history page does not tell us which business earned better returns.",
        ],
        sources: ["meritonHistory"],
        analysis: true,
      },
      {
        key: "meaning",
        chapter: "WHY IT MATTERS",
        headline: "One asset type, several uses.",
        detail: "Understand the customer and operation",
        phrases: [
          "This story shows why the word apartment is not a complete business description.",
          "The customer and the day-to-day operation matter too.",
        ],
        sources: ["meritonHistory"],
        analysis: true,
      },
      {
        key: "signOff",
        chapter: "THE TAKEAWAY",
        headline: "Who pays to use the space?",
        detail: "Read the sources / link in bio",
        phrases: [
          "When you study a property business, ask who pays to use the space, and what the operator has to deliver.",
        ],
        sources: ["meritonHistory"],
        analysis: true,
      },
    ],
  },
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
          "This is Harry Triguboff, the founder of Meriton. His story starts decades before the towers.",
          "Born in Dalian to Russian Jewish parents, he grew up in Tianjin. In nineteen forty-eight, Harry and his brother came to Sydney.",
        ],
        sources: ["triguboffInterview", "meritonFounder"],
      },
      {
        key: "value",
        chapter: "FINDING THE BUSINESS",
        headline: "Textiles. Taxis. Then apartments.",
        detail: "Early work / Roseville / Tempe",
        phrases: [
          "Textiles took him to Leeds, Israel and South Africa. Back in Australia came taxis, a milk round, and finishing his Roseville home after problems with the builder.",
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
        sources: ["meritonTempe", "triguboffSpeech", "triguboffHome"],
      },
      {
        key: "turn",
        chapter: "SURVIVAL AND EXPANSION",
        headline: "The debt. Then a new market.",
        detail: "1974\u201376 / Queensland in the 1980s",
        phrases: [
          "Domain reports thirty million Australian dollars of debt in the nineteen seventy-four and seventy-five downturn, repaid by nineteen seventy-six. Harry also held apartments for rent.",
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
          "Meriton now reports over eighty thousand apartments built. The story is how Harry changed the business behind them: how he built, sold, financed, and earned from what he kept.",
        ],
        sources: ["meritonFY2020", "meritonFounder", "triguboffSpeech"],
      },
    ],
  },
];
