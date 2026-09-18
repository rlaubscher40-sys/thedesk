export const PROPERTY_DATA_SECTIONS = [
  {
    id: "supply",
    title: "Housing supply",
    description:
      "Approvals permit construction; they are not completed homes. Check national, state and capital-city scope separately.",
  },
  {
    id: "rents",
    title: "Rents",
    description:
      "Capital-city CPI rent changes measure rents paid, not advertised weekly rents. Local bond medians are available through Markets.",
  },
  {
    id: "finance",
    title: "Housing finance",
    description:
      "The RBA cash-rate target and average new-loan rates measure different things. Neither is an individual loan offer.",
  },
  {
    id: "property",
    title: "Other property measures",
    description:
      "Definitions and coverage vary. A median, an index and an auction sample are not interchangeable.",
  },
  {
    id: "macro",
    title: "Broader economic context",
    description:
      "Population, jobs, inflation and traded markets provide context; they are not direct measurements of a local housing market.",
  },
] as const;
export function propertyDataSection(metric: { metricKey: string; groupKey?: string | null }) {
  const key = metric.metricKey;
  if (/approvals|completions|housing_supply/.test(key)) return "supply";
  if (/rent_growth|weekly_rent/.test(key)) return "rents";
  if (
    [
      "cash_rate",
      "owner_occupier_new_lending_rate",
      "investor_new_lending_rate",
      "mortgage_arrears",
    ].includes(key)
  )
    return "finance";
  if (metric.groupKey === "PROPERTY") return "property";
  return "macro";
}
