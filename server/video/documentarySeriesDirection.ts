import { DOCUMENTARY_PHOTOS } from "../../shared/documentaryPhotos";

export type SeriesShot = {
  title: string;
  kind:
    | "photo"
    | "title"
    | "ownership"
    | "split"
    | "timeline"
    | "grid"
    | "ledger"
    | "tower"
    | "room"
    | "reviews";
  lines: string[];
  note?: string;
  photo?: "rialtoArchive" | "triguboffArchive" | "meritonArchive";
  count?: number;
  accent?: "red" | "green";
};
const s = (
  kind: SeriesShot["kind"],
  title: string,
  lines: string[],
  rest: Partial<SeriesShot> = {}
): SeriesShot => ({ kind, title, lines, ...rest });
/** Every phrase has its own authored visual objective. Facts are not inferred from art. */
export const SERIES_DIRECTION = {
  version: 2,
  episodes: {
    "grollo-ownership": [
      [
        s("photo", "Meet the brothers", ["Bruno + Rino", "Grollo."], {
          photo: "rialtoArchive",
          note: "THE PEOPLE BEHIND THE BUSINESS",
        }),
      ],
      [
        s("ownership", "The retained half", ["GROLLO", "OTHER OWNER"], {
          note: "ONE BUILDING / TWO INTERESTS",
        }),
      ],
      [
        s(
          "timeline",
          "Concreting to construction",
          ["CONCRETING", "MAJOR CONTRACTS", "PROPERTY INTERESTS"],
          { note: "BUSINESS PROGRESSION / ILLUSTRATIVE" }
        ),
      ],
      [
        s("tower", "An interest beyond completion", ["Build it.", "Own a share."], {
          note: "PART-OWNERSHIP / NOT JUST CONSTRUCTION",
        }),
      ],
      [
        s("photo", "Rialto takes shape", ["Rialto.", "1986"], {
          photo: "rialtoArchive",
          note: "DEVELOPMENT YEAR / LATER PHOTOGRAPH",
        }),
      ],
      [
        s("title", "Bruno remembers the risk", ["A major risk.", "Bruno's recollection"], {
          accent: "red",
          note: "NOT A RECONSTRUCTED PROJECT RETURN",
        }),
      ],
      [
        s("ledger", "The transaction value", ["A$644m", "50% INTEREST / ENTERPRISE VALUE"], {
          note: "APRIL 2020 / NOMINAL AUD",
        }),
        s("ownership", "Only half changed hands", ["RETAINED", "SOLD"], {
          note: "A$644m / ENTERPRISE VALUE OF THE SOLD HALF",
        }),
      ],
      [
        s("ledger", "The scope of the number", ["Half interest.", "Not the whole building."], {
          note: "SOURCE: TRANSACTION ADVISER",
        }),
      ],
      [
        s("ownership", "Identify the seller", ["GROLLO", "ST MARTINS"], {
          note: "SELLER: ST MARTINS PROPERTIES",
        }),
      ],
      [
        s("ownership", "Identify the new partner", ["GROLLO", "GIC + DEXUS"], {
          note: "BUYER: GIC / DEXUS JOINT VENTURE",
        }),
      ],
      [
        s("ownership", "The Grollo half remains", ["GROLLO", "GIC + DEXUS JV"], {
          note: "GROLLO AUSTRALIA RETAINED ITS INTEREST",
        }),
      ],
      [
        s("ledger", "No invented Grollo payout", ["Not a Grollo", "payout."], {
          note: "A$644m DESCRIBED THE OTHER HALF'S DEAL",
          accent: "red",
        }),
      ],
      [
        s("timeline", "A construction contract", ["CONTRACT", "CONSTRUCTION", "HANDOVER"], {
          note: "ILLUSTRATIVE / THE DESK ANALYSIS",
        }),
      ],
      [
        s("tower", "Ownership continues", ["After the cranes.", "Costs + risks continue."], {
          note: "ILLUSTRATIVE / THE DESK ANALYSIS",
        }),
      ],
      [
        s("photo", "Return to the retained stake", ["The sale.", "The half they kept."], {
          photo: "rialtoArchive",
          note: "APRIL 2020 / HISTORICAL TRANSACTION",
        }),
      ],
      [
        s("split", "Read the ownership", ["WHAT WAS BUILT", "WHO REMAINED"], {
          note: "THE DEAL / THE DESK",
        }),
        s("photo", "The closing skyline", ["Read the", "ownership."], {
          photo: "rialtoArchive",
          note: "SOURCES AND LICENCES / LINK IN BIO",
        }),
      ],
    ],
    "grollo-family": [
      [
        s("title", "Meet Luigi", ["Luigi", "Grollo."], {
          note: "ITALY → MELBOURNE / 1928 / AGED 18",
        }),
        s("timeline", "Arrival before ambition", ["ITALY", "MELBOURNE", "1928"], {
          note: "JOURNEY CHRONOLOGY / NOT A ROUTE MAP",
        }),
      ],
      [
        s("photo", "The eventual skyline", ["From labouring", "to a skyline."], {
          photo: "rialtoArchive",
        }),
        s("ledger", "The historical endpoint", ["> A$350m", "REPORTED COMPANY WORTH / 1994"], {
          note: "NOT PERSONAL WEALTH OR CASH",
        }),
      ],
      [
        s("timeline", "The itinerant decade", ["VICTORIA", "SOUTHERN NSW", "SOUTH AUSTRALIA"], {
          note: "LABOURING / SOMETIMES LIVING IN A TENT",
        }),
      ],
      [
        s("split", "Luigi and Emma", ["LUIGI / WORK", "EMMA / FINANCES"], {
          note: "WEEKEND CONCRETING / 1948",
        }),
      ],
      [
        s("title", "A full-time enterprise", ["1952", "Leave the paid job."], {
          note: "ENOUGH WORK TO EMPLOY OTHERS",
        }),
      ],
      [
        s("grid", "Thirty-five workers", ["35", "WORKERS / 1958"], { count: 35 }),
        s("grid", "One hundred and twenty-eight", ["128", "WORKERS / 1963"], {
          count: 128,
          note: "EACH MARK = ONE WORKER",
        }),
      ],
      [
        s("tower", "The near-bankruptcy", ["Reserve Bank", "Almost lost."], {
          accent: "red",
          note: "PROJECT SCHEMATIC / NOT THE ACTUAL BUILDING",
        }),
        s("title", "The family at risk", ["Nearly", "bankrupted."], {
          accent: "red",
          note: "ANU / AUSTRALIAN DICTIONARY OF BIOGRAPHY",
        }),
      ],
      [
        s("timeline", "The 1968 handover", ["LUIGI", "1968 / HEART ATTACK", "BRUNO + RINO"], {
          note: "THE SONS TAKE OVER",
        }),
      ],
      [
        s("split", "Two brothers, different jobs", ["BRUNO / PROJECTS", "RINO / NUMBERS"], {
          note: "BRUNO'S FIRST-PERSON ACCOUNT",
        }),
      ],
      [
        s(
          "timeline",
          "The construction ladder",
          ["SWIMMING POOLS", "CIVIL ENGINEERING", "MAJOR STRUCTURES"],
          { note: "BUSINESS PROGRESSION / ILLUSTRATIVE" }
        ),
      ],
      [
        s("title", "Darwin after Tracy", ["Darwin.", "After Christmas 1974."], {
          accent: "red",
          note: "CYCLONE TRACY / RECONSTRUCTION",
        }),
        s("grid", "Four hundred houses", ["400", "HOUSES / BRUNO'S RECOLLECTION"], {
          count: 400,
          note: "EACH MARK = ONE HOUSE / ILLUSTRATIVE",
        }),
      ],
      [
        s(
          "timeline",
          "Own developments",
          ["DARWIN WORK", "SHOPPING CENTRES", "MULTISTOREY PROJECTS"],
          { note: "CHRONOLOGY / NOT A TRACED CASH TRANSFER" }
        ),
      ],
      [
        s("tower", "Rialto rises", ["1982–1986", "Rialto."], {
          note: "SCHEMATIC / NOT A FLOOR COUNT",
        }),
        s("photo", "The built result", ["A bigger", "commitment."], {
          photo: "rialtoArchive",
          note: "LATER PHOTOGRAPH / 2009",
        }),
      ],
      [
        s(
          "timeline",
          "How the enterprise changed",
          ["LABOUR", "CONSTRUCTION", "DEVELOPMENT + OWNERSHIP"],
          { note: "THE DESK ANALYSIS" }
        ),
      ],
      [
        s("ledger", "Qualify the company worth", ["> A$350m", "REPORTED COMPANY WORTH / 1994"], {
          note: "NOT CASH / NOT PROFIT / NOT TODAY'S VALUE",
        }),
      ],
      [
        s("split", "Remember both generations", ["LUIGI + EMMA", "BRUNO + RINO"], {
          note: "WORK / FINANCE / DELIVERY / OWNERSHIP",
        }),
        s("photo", "The family behind the skyline", ["Behind", "the skyline."], {
          photo: "rialtoArchive",
          note: "A HISTORICAL CHAPTER / 1928–1994",
        }),
      ],
    ],
    "meriton-accommodation": [
      [
        s("photo", "Meet Harry", ["Harry", "Triguboff."], {
          photo: "triguboffArchive",
          note: "FOUNDER / MERITON",
        }),
      ],
      [
        s("title", "The 2003 launch", ["2003", "A different customer."], {
          note: "MERITON SERVICED APARTMENTS",
        }),
      ],
      [
        s("room", "An apartment becomes a stay", ["Self-contained.", "Space to stay."], {
          note: "ILLUSTRATIVE ROOM / NOT AN ACTUAL SUITE",
        }),
      ],
      [
        s(
          "ledger",
          "Company explanation, not returns",
          ["A market gap.", "The company's account."],
          { note: "NO COMPARATIVE RETURNS ESTABLISHED" }
        ),
      ],
      [
        s("split", "Buyer and guest", ["BUYER / INTEREST", "GUEST / STAY"], {
          note: "ILLUSTRATIVE / NOT A CASH-FLOW MODEL",
        }),
      ],
      [
        s("room", "An ongoing operation", ["Book. Stay.", "Service. Repeat."], {
          note: "THE DESK ANALYSIS / ILLUSTRATIVE",
        }),
        s("timeline", "The operating cycle", ["BOOKING", "GUEST EXPERIENCE", "NEXT STAY"], {
          note: "OPERATING WORK / NOT GUARANTEED INCOME",
        }),
      ],
      [s("title", "The 2017 rebrand", ["Meriton", "Suites."], { note: "JUNE 2017 / REBRAND" })],
      [
        s("reviews", "Reviews become a business risk", ["Customer", "reviews."], {
          note: "ILLUSTRATION / NOT A REAL REVIEW OR RATING",
        }),
      ],
      [
        s("ledger", "The court penalty", ["A$3m", "FEDERAL COURT / 31 JULY 2018"], {
          accent: "red",
          note: "MERITON PROPERTY SERVICES PTY LTD",
        }),
      ],
      [
        s("reviews", "The regulator's finding", ["Review", "manipulation."], {
          accent: "red",
          note: "HISTORICAL FINDING / ACCC REPORT",
        }),
      ],
      [
        s("reviews", "Invitations that did not arrive", ["Guest email", "Invitation blocked"], {
          accent: "red",
          note: "EMAIL MASKING / EXPLANATORY SCHEMATIC",
        }),
        s("title", "The missing feedback", ["No invitation.", "A distorted picture."], {
          accent: "red",
          note: "POTENTIALLY NEGATIVE REVIEWS",
        }),
      ],
      [
        s("ledger", "Company, not individual", ["Company penalty.", "Not Harry personally."], {
          note: "A HISTORICAL FINDING / NOT CURRENT CONDUCT",
        }),
      ],
      [
        s("title", "The Melbourne opening", ["Melbourne.", "September 2023."], {
          note: "OPENING MILESTONE / COMPANY SOURCE",
        }),
        s("grid", "The new hotel's capacity", ["298", "APARTMENT-STYLE HOTEL SUITES"], {
          count: 298,
          note: "EACH MARK = ONE SUITE / NOT OCCUPANCY",
        }),
      ],
      [
        s("ledger", "Capacity is not profit", ["298 suites.", "Not a profit figure."], {
          note: "NO OCCUPANCY OR RETURNS CLAIMED",
        }),
      ],
      [
        s("photo", "The property and the operation", ["Beyond", "the building."], {
          photo: "meritonArchive",
          note: "SYDNEY CONTEXT / NOT THE MELBOURNE HOTEL",
        }),
      ],
      [
        s("room", "Return the keys", ["Deliver the stay.", "Every time."], {
          note: "THE DEAL / THE DESK / ILLUSTRATIVE",
        }),
        s("title", "The final operating idea", ["Build.", "Operate. Repeat."], {
          note: "SOURCES AND LICENCES / LINK IN BIO",
        }),
      ],
    ],
  } as Record<string, SeriesShot[][]>,
};

export const SERIES_ASSETS = Object.fromEntries(
  ["rialtoArchive", "triguboffArchive", "meritonArchive"].map((key) => {
    const p = DOCUMENTARY_PHOTOS[key as keyof typeof DOCUMENTARY_PHOTOS];
    return [key, { file: p.asset, sha256: p.sha256, credit: p.credit }];
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
