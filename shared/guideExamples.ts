/** Hypothetical arithmetic, never observations or forecasts. */
export const GUIDE_EXAMPLES: Record<string, { title: string; text: string }> = {
  "interest-rates": {
    title: "A rate change in dollars",
    text: "For a hypothetical $500,000 principal-and-interest loan over 30 years, monthly repayments are about $2,998 at 6.00% and $3,079 at 6.25%: about $81 more. This assumes monthly payments, a constant rate and no fees. Use the repayment tool below for the calculation; an RBA cash-rate change does not guarantee the same change in your loan rate.",
  },
  "housing-supply": {
    title: "Gross is not net",
    text: "If 100 dwellings are completed and 20 are demolished in the same area and period, the simplified net addition is 100 − 20 = 80. An approval for another 100 dwellings adds nothing to this completed count. Real stock accounting can also include conversions and boundary changes.",
  },
  rents: {
    title: "Slower growth can still mean a higher rent",
    text: "A hypothetical weekly rent rising from $600 to $630 has increased by ($630 − $600) ÷ $600 × 100 = 5%. If a comparable annual growth measure later falls from 5% to 4%, that is a fall of 1 percentage point in the growth rate, not a 1% fall in rent. A median asking rent is also a different measure from the ABS CPI rents-paid index.",
  },
  population: {
    title: "Net movement is not housing demand",
    text: "If 1,000 people arrive and 700 depart during the same period and within the same boundary, net movement is 300 people. It is not 300 households or 300 extra homes required: household size, existing accommodation and other population components still matter.",
  },
  "house-prices": {
    title: "The median can move because the mix changes",
    text: "Three sales at $400,000, $500,000 and $900,000 have a $500,000 median. Three later sales at $500,000, $900,000 and $1,000,000 have a $900,000 median. Without matching properties or adjusting for their characteristics, that does not demonstrate that an individual home rose 80%.",
  },
  auctions: {
    title: "Check the denominator",
    text: "If a provider records 60 clearances among 100 results included in its measure, the rate is 60%. If another 20 scheduled auctions have no result yet, do not silently treat them as either sold or unsold. Follow the provider’s rules for withdrawals, late results and prior sales before comparing rates.",
  },
  "housing-tenure": {
    title: "A proposal is not delivered stock",
    text: "A hypothetical proposal for 60 social and 40 affordable dwellings totals 100 proposed homes. It does not establish 100 completed or occupied homes. Check the definitions, eligibility, tenure and project status before adding them to a supply count.",
  },
};
