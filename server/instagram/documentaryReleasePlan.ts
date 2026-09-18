/** Scheduling is separate from immutable render inputs and permanent receipts. */
export const DOCUMENTARY_RELEASE_DATES: Readonly<Record<string, string>> = {
  "triguboff-apartments": "2026-09-20",
  "lowy-westfield": "2026-09-23",
  "grollo-family": "2026-09-27",
  "walker-rebuild": "2026-09-30",
};

export type ReelEditorialIdentity = {
  subjects: string[];
  events: string[];
  takeaways: string[];
};

/** Authored meaning, not keyword/fame scores or a title-only duplicate check.
 * Founder, company and family aliases resolve to the same subject. */
const documentaryIdentities: Record<string, ReelEditorialIdentity> = {
  "triguboff-apartments": {
    subjects: ["harry-triguboff-meriton"],
    events: ["meriton-business-progression-1963-2026", "meriton-debt-crisis-1974-1976"],
    takeaways: ["meriton-sales-finance-rental-accommodation-model"],
  },
  "grollo-family": {
    subjects: ["grollo-family"],
    events: ["grollo-business-progression-1928-1994"],
    takeaways: ["grollo-labour-to-development-and-ownership"],
  },
  "lowy-westfield": {
    subjects: ["lowy-saunders-westfield"],
    events: ["westfield-float-1960-hornsby-1961"],
    takeaways: ["westfield-equity-funding-expansion"],
  },
  "walker-rebuild": {
    subjects: ["lang-walker-corporation"],
    events: ["walker-exits-1999-2006"],
    takeaways: ["walker-sell-and-rebuild-without-inferred-profit"],
  },
  "grollo-ownership": {
    subjects: ["grollo-family"],
    events: ["rialto-st-martins-sale-2020"],
    takeaways: ["grollo-retained-half-is-not-sale-proceeds"],
  },
  "meriton-accommodation": {
    subjects: ["harry-triguboff-meriton"],
    events: ["meriton-suites-2003-2023"],
    takeaways: ["meriton-accommodation-operating-model"],
  },
};

/** Only known, researched programme identities are classified. Unknown recipes
 * require editorial registration before a documentary can clear their history. */
export function reelEditorialIdentity(key: string): ReelEditorialIdentity | null {
  const id = key.match(/^instagram-reel-documentary-(.+)-v1$/)?.[1];
  if (id) return documentaryIdentities[id] ?? null;
  const ordinary: Record<string, ReelEditorialIdentity> = {
    "instagram-reel-abs-rents-brisbane-perth-v1": {
      subjects: ["brisbane-perth-rents"],
      events: ["abs-cpi-rents"],
      takeaways: ["annual-rent-index-city-comparison"],
    },
    "instagram-reel-abs-approvals-brisbane-perth-v1": {
      subjects: ["brisbane-perth-approvals"],
      events: ["abs-dwelling-approvals"],
      takeaways: ["approvals-versus-existing-housing-stock"],
    },
    "instagram-reel-abs-rents-eight-capitals-v1": {
      subjects: ["capital-city-rents"],
      events: ["abs-cpi-rents"],
      takeaways: ["annual-rent-index-capital-comparison"],
    },
    "instagram-reel-abs-sydney-rent-change-v1": {
      subjects: ["sydney-rents"],
      events: ["abs-cpi-rents"],
      takeaways: ["change-in-annual-rent-growth"],
    },
    "instagram-reel-nhsac-housing-balance-v1": {
      subjects: ["australian-housing-balance"],
      events: ["nhsac-net-supply-new-demand"],
      takeaways: ["net-homes-versus-new-housing-need"],
    },
    "instagram-reel-rba-new-loan-rates-v1": {
      subjects: ["australian-new-housing-loans"],
      events: ["rba-f6-new-loan-rates"],
      takeaways: ["owner-occupier-investor-borrowing-costs"],
    },
    "instagram-reel-abs-interstate-qld-wa-v1": {
      subjects: ["queensland-wa-population"],
      events: ["abs-interstate-migration"],
      takeaways: ["net-interstate-movement-not-housing-demand"],
    },
  };
  const city = key.match(
    /^instagram-reel-abs-(sydney|melbourne|brisbane|adelaide|perth|hobart|darwin|canberra)-before-buy-v1$/
  )?.[1];
  if (city)
    return {
      subjects: [`${city}-approvals`],
      events: ["abs-dwelling-approvals"],
      takeaways: ["approvals-are-not-completed-homes"],
    };
  return ordinary[key] ?? null;
}

export function documentaryOverlap(a: ReelEditorialIdentity, b: ReelEditorialIdentity) {
  const overlaps = (left: string[], right: string[]) => left.some((id) => right.includes(id));
  // Repeated subject is held too until an explicit, evidence-backed distinction
  // is added. A different title never establishes a different story.
  return (
    overlaps(a.subjects, b.subjects) ||
    overlaps(a.events, b.events) ||
    overlaps(a.takeaways, b.takeaways)
  );
}
