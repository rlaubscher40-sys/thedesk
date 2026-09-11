/** Existing, public, free reads. No generated URLs or paid answer on arrival. */
export const SOCIAL_DESTINATIONS = [
  {
    label: "Brisbane vs Perth rents",
    detail: "Compare matching rent figures and their limits.",
    path: "/markets/compare/brisbane-vs-perth",
  },
  {
    label: "What changed in Sydney rents?",
    detail: "Annual changes, reference months and the ABS source.",
    path: "/markets/sydney#rental-conditions",
  },
  {
    label: "Before you buy: Sydney supply",
    detail: "Approvals are permission, not homes ready to occupy.",
    path: "/markets/sydney#housing-approvals",
  },
  {
    label: "Brisbane and Perth supply",
    detail: "Open the comparison's approvals panel.",
    path: "/markets/compare/brisbane-vs-perth#housing-approvals",
  },
  {
    label: "Australia's housing supply gap",
    detail: "Matched supply and demand, the 55,000 gap and the source.",
    path: "/markets/housing-balance",
  },
  {
    label: "New home-loan rates",
    detail: "Average new owner-occupier and investor rates, with RBA sources.",
    path: "/social#new-loan-rates",
  },
  {
    label: "Queensland and WA migration",
    detail: "State population and net migration in the comparison's demand context.",
    path: "/markets/compare/brisbane-vs-perth#state-population",
  },
] as const;
export function socialStoryPath(value: string): string | null {
  if (!/^[1-9]\d{0,9}$/.test(value)) return null;
  return `/story/${value}`;
}
