/** Source targeting is separate from geography actually mentioned in evidence. */
export const PROPERTY_REGIONS = [
  {
    code: "NSW",
    name: "New South Wales",
    places: [
      "Sydney",
      "Newcastle",
      "Wollongong",
      "Central Coast",
      "Port Macquarie",
      "Wagga Wagga",
      "Dubbo",
      "Orange",
      "Albury",
      "Tweed Heads",
      "Northern Rivers",
      "Lismore",
      "Ballina",
      "Bega",
      "Bega Valley",
      "Eurobodalla",
      "Shoalhaven",
    ],
    domain: "nsw.gov.au",
  },
  {
    code: "VIC",
    name: "Victoria",
    places: [
      "Melbourne",
      "Geelong",
      "Ballarat",
      "Bendigo",
      "Mildura",
      "Shepparton",
      "Gippsland",
      "Wodonga",
    ],
    domain: "vic.gov.au",
  },
  {
    code: "QLD",
    name: "Queensland",
    places: [
      "Brisbane",
      "Gold Coast",
      "Sunshine Coast",
      "Townsville",
      "Cairns",
      "Toowoomba",
      "Rockhampton",
      "Mackay",
      "Bundaberg",
    ],
    domain: "qld.gov.au",
  },
  {
    code: "WA",
    name: "Western Australia",
    places: [
      "Perth",
      "Bunbury",
      "Geraldton",
      "Albany",
      "Busselton",
      "Kalgoorlie",
      "Karratha",
      "Port Hedland",
    ],
    domain: "wa.gov.au",
  },
  {
    code: "SA",
    name: "South Australia",
    places: [
      "Adelaide",
      "Mount Gambier",
      "Murray Bridge",
      "Whyalla",
      "Port Lincoln",
      "Port Augusta",
    ],
    domain: "sa.gov.au",
  },
  {
    code: "TAS",
    name: "Tasmania",
    places: ["Hobart", "Launceston", "Devonport", "Burnie"],
    domain: "tas.gov.au",
  },
  {
    code: "ACT",
    name: "Australian Capital Territory",
    places: ["Canberra", "Belconnen", "Gungahlin", "Tuggeranong"],
    domain: "act.gov.au",
  },
  {
    code: "NT",
    name: "Northern Territory",
    places: ["Darwin", "Palmerston", "Alice Springs", "Katherine", "Tennant Creek"],
    domain: "nt.gov.au",
  },
] as const;
export type PropertyRegion = (typeof PROPERTY_REGIONS)[number]["code"];

export function evidenceRegions(text: string): PropertyRegion[] {
  return PROPERTY_REGIONS.filter((region) => {
    // ACT/SA/WA are ambiguous words in ordinary lower-case prose.
    if (new RegExp(`\\b${region.code}\\b`).test(text)) return true;
    return [region.name, ...region.places].some((place) =>
      new RegExp(`\\b${place}\\b`, "i").test(text)
    );
  }).map((region) => region.code);
}

const PROPERTY_BEATS = {
  housing: /\b(housing|property|real estate|dwellings?|apartments?|home buyers?)\b/i,
  rents: /\b(rents?|rental|vacanc(?:y|ies)|tenan(?:t|cy|ts))\b/i,
  supply: /\b(construction|building approvals|planning|rezoning|zoning|development|subdivision)\b/i,
  credit: /\b(mortgages?|lending|home loans?|interest rates?|cash rate|serviceability|arrears)\b/i,
  demand: /\b(population|migration|employment|unemployment|infrastructure|inflation)\b/i,
  policy:
    /\b(housing policy|stamp duty|land tax|negative gearing|tenancy|housing reform|capital gains)\b/i,
} as const;
export function evidenceTopics(text: string): string[] {
  return Object.entries(PROPERTY_BEATS)
    .filter(([, pattern]) => pattern.test(text))
    .map(([key]) => key);
}

export function sourceHealth(
  status:
    | {
        checkedAt: Date;
        lastSuccessAt: Date | null;
        error: string | null;
        accepted: number;
        newestPublishedAt: Date | null;
      }
    | undefined,
  now = new Date()
) {
  if (!status) return "not checked";
  if (now.getTime() - status.checkedAt.getTime() > 3 * 3_600_000) return "overdue";
  if (status.error) return "failed";
  if (!status.accepted) return "no usable evidence";
  if (
    !status.newestPublishedAt ||
    now.getTime() - status.newestPublishedAt.getTime() > 7 * 86_400_000
  )
    return "older evidence";
  return "collecting";
}
