import { DOCUMENTARY_PHOTOS } from "../../shared/documentaryPhotos";

export type SeriesShot = {
  title: string;
  kind:
    | "photo"
    | "portrait"
    | "pair"
    | "amount"
    | "voyage"
    | "camp"
    | "calculation"
    | "concrete"
    | "workforce"
    | "family"
    | "risk"
    | "houses"
    | "mall"
    | "shares"
    | "funding"
    | "route"
    | "earthworks"
    | "portfolio"
    | "dateline";
  lines: string[];
  note?: string;
  photo?: keyof typeof DOCUMENTARY_PHOTOS;
  secondPhoto?: keyof typeof DOCUMENTARY_PHOTOS;
  layout?: "full" | "plate" | "strip" | "detail";
  count?: number;
  labels?: string[];
  accent?: "red" | "green";
};
const s = (
  kind: SeriesShot["kind"],
  title: string,
  lines: string[],
  rest: Partial<SeriesShot> = {}
): SeriesShot => ({ kind, title, lines, ...rest });
/** Each phrase is directed around an event. No shared biography slideshow. */
export const SERIES_DIRECTION = {
  version: 4,
  episodes: {
    "grollo-family": [
      [
        s("voyage", "Introduce Luigi and his arrival", ["Luigi", "Grollo."], {
          note: "ITALY → MELBOURNE / 1928 / AGED 18",
        }),
        s("voyage", "The journey before the business", ["A new country.", "Aged eighteen."], {
          note: "JOURNEY CHRONOLOGY / ORIGINAL ILLUSTRATION",
        }),
      ],
      [
        s("pair", "The later Melbourne skyline", ["A family", "changes scale."], {
          photo: "collinsStreet",
          secondPhoto: "rialtoPark",
          note: "MELBOURNE / LATER PHOTOGRAPHS: 2010 + 2008",
        }),
        s("amount", "The historical endpoint", ["> A$350m", "REPORTED COMPANY WORTH / 1994"], {
          photo: "rialtoArchive",
          note: "HISTORICAL COMPANY MEASURE",
        }),
      ],
      [
        s("camp", "A decade of itinerant work", ["Ten years.", "Following the work."], {
          note: "VIC / SOUTHERN NSW / SA / SOMETIMES A TENT",
        }),
        s(
          "concrete",
          "The work before the towers",
          ["Labour first.", "The business comes later."],
          { note: "ORIGINAL WORK ILLUSTRATION / NOT ARCHIVE" }
        ),
      ],
      [
        s("concrete", "Weekend concreting begins", ["1948", "Weekend concreting."], {
          note: "LUIGI BUILDS THE EARLY BUSINESS",
        }),
        s("family", "Emma keeps the business running", ["LUIGI / THE WORK", "EMMA / THE BOOKS"], {
          note: "EMMA MANAGES FINANCES / ORIGINAL ROLE DIAGRAM",
        }),
      ],
      [
        s("concrete", "The paid job gives way", ["1952", "Full-time."], {
          note: "ENOUGH WORK TO LEAVE THE PAID JOB",
        }),
      ],
      [
        s("workforce", "Count the early workforce", ["35", "WORKERS / 1958"], {
          count: 35,
          note: "ONE FIGURE = ONE WORKER",
        }),
        s("workforce", "Reveal the next workforce scale", ["128", "WORKERS / 1963"], {
          count: 128,
          note: "ONE FIGURE = ONE WORKER",
        }),
      ],
      [
        s("risk", "A major contract threatens the family", ["Reserve Bank.", "Nearly bankrupt."], {
          accent: "red",
          note: "MELBOURNE PROJECT / SCHEMATIC, NOT ITS DESIGN",
        }),
        s("risk", "Hold the consequence", ["The family", "at risk."], {
          accent: "red",
          note: "NO VERIFIED LOSS AMOUNT / ANU BIOGRAPHY",
        }),
      ],
      [
        s("family", "The 1968 handover", ["LUIGI / 1968", "BRUNO + RINO"], {
          note: "AFTER LUIGI'S HEART ATTACK",
        }),
      ],
      [
        s("family", "Bruno wins and oversees work", ["BRUNO", "WINNING + OVERSEEING JOBS"], {
          note: "BRUNO'S FIRST-PERSON ACCOUNT",
        }),
        s("family", "Rino handles office and numbers", ["RINO", "OFFICE + NUMBERS"], {
          note: "TWO DISTINCT ROLES / ONE ENTERPRISE",
        }),
      ],
      [
        s("concrete", "Concrete expertise expands", ["Pools.", "Civil engineering."], {
          note: "ORIGINAL CONSTRUCTION ILLUSTRATION",
        }),
        s(
          "risk",
          "Structures for major builders",
          ["Bigger structures.", "Bigger responsibility."],
          { note: "SCHEMATIC / NOT A NAMED PROJECT" }
        ),
      ],
      [
        s("photo", "Darwin after the cyclone", ["Christmas 1974.", "Darwin."], {
          photo: "tracy",
          layout: "plate",
          accent: "red",
          note: "ACTUAL CYCLONE AFTERMATH / NOT GROLLO HOUSES",
        }),
        s("houses", "Show the reconstruction scale", ["400 houses.", "BRUNO'S RECOLLECTION"], {
          photo: "tracy",
          count: 40,
          note: "ONE ROOF = TEN HOUSES / SCHEMATIC",
        }),
      ],
      [
        s("mall", "The family develops its own property", ["Their own", "developments."], {
          note: "SHOPPING CENTRES + MULTISTOREY PROJECTS",
        }),
        s(
          "portfolio",
          "Contracts alongside property interests",
          ["CONTRACTS", "OWN DEVELOPMENTS"],
          {
            labels: ["CONSTRUCTION CONTRACTS", "SHOPPING CENTRES", "MULTISTOREY DEVELOPMENT"],
            note: "BUSINESS MIX / NOT A CASH-TRANSFER DIAGRAM",
          }
        ),
      ],
      [
        s("risk", "Rialto's construction chapter", ["1982–1986", "Rialto."], {
          note: "CONSTRUCTION CHRONOLOGY / ORIGINAL SCHEMATIC",
        }),
        s("photo", "Reveal the real Rialto", ["A major", "commitment."], {
          photo: "rialtoPark",
          layout: "full",
          note: "RIALTO / LATER PHOTOGRAPH / 2008",
        }),
      ],
      [
        s(
          "pair",
          "Building and owning change the model",
          ["From labour", "to property interests."],
          {
            photo: "collinsStreet",
            secondPhoto: "rialtoArchive",
            note: "THE DESK ANALYSIS / LATER MELBOURNE VIEWS",
          }
        ),
      ],
      [
        s(
          "amount",
          "Name the financial measure precisely",
          ["> A$350m", "REPORTED COMPANY WORTH / 1994"],
          { photo: "rialtoPark", note: "COMPANY WORTH / NOT PERSONAL CASH OR PROFIT" }
        ),
        s(
          "photo",
          "Keep the history rooted in a real city",
          ["The business", "behind the skyline."],
          { photo: "collinsStreet", layout: "detail", note: "COLLINS STREET / 2010 CONTEXT" }
        ),
      ],
      [
        s("family", "Bring both generations back", ["LUIGI + EMMA", "BRUNO + RINO"], {
          note: "GROUNDWORK / FINANCE / DELIVERY / OWNERSHIP",
        }),
        s("photo", "Finish on the built legacy", ["Behind", "the skyline."], {
          photo: "rialtoArchive",
          layout: "full",
          note: "GROLLO FAMILY / A HISTORICAL CHAPTER",
        }),
      ],
    ],
    "lowy-westfield": [
      [
        s("portrait", "Introduce Frank Lowy", ["Frank", "Lowy."], {
          photo: "lowyPortrait",
          note: "WESTFIELD CO-FOUNDER / ARCHIVE UPLOADED 2008",
        }),
      ],
      [
        s("photo", "Ask who funds expansion", ["Who funds", "the next one?"], {
          photo: "hornsby",
          layout: "full",
          note: "HORNSBY / LATER REDEVELOPMENT / PHOTO 2018",
        }),
      ],
      [
        s("mall", "Show the first centre's ingredients", ["Blacktown.", "1959"], {
          count: 12,
          note: "12 SHOPS + 2 DEPARTMENT STORES + SUPERMARKET",
        }),
        s("mall", "Keep the early scale visible", ["Twelve shops.", "One starting point."], {
          count: 12,
          note: "SCHEMATIC / NOT THE ORIGINAL FLOOR PLAN",
        }),
      ],
      [
        s("dateline", "Take the business to the exchange", ["1960", "Going public."], {
          note: "SEPTEMBER / SYDNEY STOCK EXCHANGE",
        }),
      ],
      [
        s("shares", "Reveal the issued share count", ["300,000", "ORDINARY SHARES"], {
          note: "1960 SHARE ISSUE / CORPORATE HISTORY",
        }),
      ],
      [
        s("calculation", "Explain the issue arithmetic", ["300,000 shares", "× A$0.50"], {
          note: "OFFICIAL DECIMAL EQUIVALENT / HISTORICAL",
        }),
        s("amount", "Show aggregate issue value", ["A$150,000", "AGGREGATE SHARE ISSUE VALUE"], {
          note: "300,000 × A$0.50 / BEFORE ANY ISSUE COSTS",
        }),
      ],
      [
        s("funding", "Connect the float to the next project", ["THE FLOAT", "HORNSBY / 1961"], {
          note: "SOURCE EXPLICITLY CONNECTS FLOAT TO HORNSBY",
        }),
      ],
      [
        s(
          "amount",
          "Reveal the reported centre cost",
          ["A$690,000", "HORNSBY / REPORTED CENTRE COST"],
          { note: "HISTORICAL DECIMAL EQUIVALENT / NOT TODAY'S MONEY" }
        ),
        s("photo", "Locate Hornsby in the real world", ["Hornsby.", "The next centre."], {
          photo: "hornsby",
          layout: "plate",
          note: "LATER REDEVELOPED CENTRE / PHOTOGRAPH 2018",
        }),
      ],
      [
        s("mall", "The next centre's shop count", ["22", "STORES / HORNSBY 1961"], {
          count: 22,
          note: "SCHEMATIC SHOP COUNT / NOT THE ACTUAL PLAN",
        }),
      ],
      [
        s("mall", "Eight centres by the end of 1962", ["8 centres.", "Completed or developing."], {
          count: 8,
          note: "SYDNEY / END 1962 / ONE BLOCK = ONE CENTRE",
        }),
      ],
      [
        s("route", "Queensland joins the business", ["1967 / TOOMBUL", "QUEENSLAND"], {
          note: "EXPANSION CHRONOLOGY",
        }),
        s("route", "Victoria follows", ["1969 / DONCASTER", "VICTORIA"], {
          note: "EXPANSION CHRONOLOGY",
        }),
      ],
      [
        s("route", "The first American acquisition", ["1977", "TRUMBULL / CONNECTICUT"], {
          note: "FIRST US CENTRE / CHRONOLOGY, NOT A TRAVEL ROUTE",
        }),
      ],
      [
        s("photo", "A much later London opening", ["London.", "2011"], {
          photo: "lowyLaunch",
          layout: "plate",
          note: "ACTUAL STRATFORD OPENING / 13 SEPTEMBER 2011",
        }),
      ],
      [
        s("pair", "Two places show the change of scale", ["A business", "that travelled."], {
          photo: "hornsby",
          secondPhoto: "lowyLaunch",
          note: "HORNSBY 2018 + STRATFORD 2011 / DATED CONTEXT",
        }),
      ],
      [
        s("photo", "Return to the person", ["More than", "opening shops."], {
          photo: "lowyPortrait",
          layout: "detail",
          note: "LOWY / ARCHIVE UPLOADED 2008",
        }),
      ],
      [
        s("funding", "Answer the funding question", ["RAISE CAPITAL", "BUILD THE NEXT CENTRE"], {
          note: "THE DESK ANALYSIS / NO INVESTMENT RETURN CLAIM",
        }),
        s("photo", "Finish with the real expansion", ["The next", "centre."], {
          photo: "lowyLaunch",
          layout: "full",
          note: "FRANK LOWY + JOHN SAUNDERS / WESTFIELD",
        }),
      ],
    ],
    "walker-rebuild": [
      [
        s("photo", "Introduce Lang Walker through his waterfront work", ["Lang", "Walker."], {
          photo: "wharf",
          layout: "full",
          note: "DEVELOPER / FINGER WHARF / LATER PHOTO 2023",
        }),
      ],
      [
        s("dateline", "Establish the two major exits", ["1999", "2006"], {
          note: "TWO MAJOR EXITS / ONE DEVELOPMENT CAREER",
        }),
      ],
      [
        s("earthworks", "The father-and-son beginning", ["1964", "Earthmoving."], {
          note: "LANG + HIS FATHER / ORIGINAL ILLUSTRATION",
        }),
      ],
      [
        s("earthworks", "Move from earthmoving to development", ["1972", "Property development."], {
          note: "THE WALKER GROUP / ORIGINAL ILLUSTRATION",
        }),
      ],
      [
        s("shares", "The listed company chapter", ["1994", "The company lists."], {
          note: "AUSTRALIAN STOCK EXCHANGE",
        }),
      ],
      [
        s("portfolio", "The first exit", ["1999", "SHARES SOLD TO AUSTRALAND"], {
          note: "HISTORICAL SHARE TRANSACTION",
        }),
        s("dateline", "A name kept for a later chapter", ["The right", "to return."], {
          note: "RIGHT TO REUSE THE WALKER CORPORATION NAME",
        }),
      ],
      [
        s("dateline", "The name is used again", ["2003", "Walker returns."], {
          note: "McROSS RENAMED WALKER CORPORATION",
        }),
      ],
      [
        s("portfolio", "The second portfolio sale", ["2006", "PORTFOLIO SOLD TO MIRVAC"], {
          note: "PROPERTY + BUSINESS ASSETS",
        }),
        s(
          "amount",
          "The rounded reported transaction",
          ["> A$1.1bn", "REPORTED PORTFOLIO TRANSACTION"],
          { note: "2006 / ROUNDED HISTORICAL SECONDARY-SOURCE FIGURE" }
        ),
      ],
      [
        s(
          "portfolio",
          "Distinguish assets from personal profit",
          ["ASSETS + BUSINESSES", "TRANSACTION VALUE"],
          { note: "NOT A PERSONAL PROFIT FIGURE" }
        ),
      ],
      [
        s(
          "portfolio",
          "Identify the interests that remained",
          ["INDUSTRIAL", "SOME COMMERCIAL + RETAIL"],
          {
            labels: ["INDUSTRIAL", "SOME COMMERCIAL", "SOME RETAIL"],
            accent: "green",
            note: "INTERESTS RETAINED / NO QUANTITIES INFERRED",
          }
        ),
      ],
      [
        s(
          "dateline",
          "The timing is historical, not clairvoyance",
          ["2006 / SALE", "BEFORE THE GFC"],
          { note: "TIMING / NOT A CLAIM THAT HE PREDICTED THE CRISIS" }
        ),
      ],
      [
        s("photo", "The next development chapter", ["Building", "again."], {
          photo: "parramattaBuild",
          layout: "detail",
          note: "PARRAMATTA SQUARE / MARCH 2020",
        }),
        s("photo", "The later precinct", ["Parramatta", "Square."], {
          photo: "parramatta",
          layout: "full",
          note: "6 + 8 PARRAMATTA SQUARE / 2023",
        }),
      ],
      [
        s("photo", "Anchor the project number in a place", ["A different", "scale."], {
          photo: "parramatta",
          layout: "plate",
          note: "ONE PART OF THE PRECINCT / PHOTOGRAPH 2023",
        }),
        s(
          "amount",
          "ABC's dated project figure",
          ["A$3.5bn", "PARRAMATTA SQUARE / PROJECT FIGURE"],
          { photo: "parramattaBuild", note: "ABC NEWS / JANUARY 2024 / WHOLE PROJECT" }
        ),
      ],
      [
        s(
          "amount",
          "Keep the financial measure readable",
          ["Project scale.", "Not developer profit."],
          { photo: "parramatta", note: "NO CLAIM ABOUT HIS PERSONAL RETURN" }
        ),
      ],
      [
        s("earthworks", "Recall the early earthmoving business", ["From the ground", "up."], {
          note: "THE DESK ANALYSIS / ORIGINAL ILLUSTRATION",
        }),
        s("photo", "Move through a transformed interior", ["Reshaping", "places."], {
          photo: "wharfInterior",
          layout: "full",
          note: "FINGER WHARF / LATER PHOTO 2018",
        }),
      ],
      [
        s("pair", "Connect waterfront and city precinct", ["Sell.", "Build again."], {
          photo: "wharf",
          secondPhoto: "parramatta",
          note: "DISTINCT PROJECTS / NOT A TRACED FINANCING CHAIN",
        }),
        s("photo", "End on another beginning", ["Another", "beginning."], {
          photo: "wharfInterior",
          layout: "detail",
          note: "LANG WALKER / A HISTORICAL BUSINESS CHAPTER",
        }),
      ],
    ],
  } as Record<string, SeriesShot[][]>,
};

const assetKeys = [
  ...new Set(
    Object.values(SERIES_DIRECTION.episodes)
      .flat(2)
      .flatMap((s) => [s.photo, s.secondPhoto])
      .filter((key): key is keyof typeof DOCUMENTARY_PHOTOS => !!key)
  ),
];
export const SERIES_ASSETS = Object.fromEntries(
  assetKeys.map((key) => {
    const p = DOCUMENTARY_PHOTOS[key];
    return [
      key,
      {
        file: p.asset,
        sha256: p.sha256,
        credit: p.credit,
        focus: p.focus,
        verticalFocus: p.verticalFocus,
      },
    ];
  })
);
export function seriesShots(id: string, phrase: number) {
  const shots = SERIES_DIRECTION.episodes[id]?.[phrase];
  if (!shots?.length) throw new Error("Missing authored series sequence.");
  return shots;
}
export function seriesCuts(id: string) {
  if (!SERIES_DIRECTION.episodes[id]) throw new Error("Unknown series film.");
  return SERIES_DIRECTION.episodes[id]!.map((shots) => shots.map((_, i) => i / shots.length));
}
