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
] as const;
export function socialStoryPath(value: string): string | null {
  if (!/^[1-9]\d{0,9}$/.test(value)) return null;
  return `/story/${value}`;
}
