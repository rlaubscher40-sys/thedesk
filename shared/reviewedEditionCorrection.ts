/** Exact observed phrases only, scoped by the database repair to Edition 17.
 * Qualifications withdraw unsupported certainty; they add no market forecast. */
const REPLACEMENTS = [
  [
    "The most expensive homes are falling first, not because sentiment cracked but because borrowing power did",
    "The reports describe falls at the expensive end, where borrowing capacity is one possible mechanism rather than proof of the cause",
  ],
  [
    "The core read held. Rates rising into a widening correction with no relief coming was the spine of last week's calls, and every RBA voice this week confirmed it.",
    "The week's reporting supported the risk of higher rates alongside weaker housing. It did not confirm that further hikes or an absence of future relief were certain.",
  ],
  [
    "so the direction is right but the date is drifting.",
    "so both the next decision and its timing remain unresolved.",
  ],
  [
    "Canberra is shrinking the pipeline it says it wants to grow",
    "Industry modelling projects a smaller housing pipeline",
  ],
  [
    "the negative gearing and CGT reforms have clearly moved from sentiment into behaviour.",
    "investor selling alone does not isolate the effect of negative gearing or CGT changes.",
  ],
  [
    "Another hike directly cuts the maximum loan a buyer can be approved for and lifts repayments on everyone already holding debt, right as spring listings arrive.",
    "A higher loan rate can reduce borrowing capacity and increase variable-rate repayments. Existing fixed-rate repayments normally stay unchanged during their agreed term; lender pass-through and loan conditions matter.",
  ],
  [
    "The rate cut trade is dead, and the market has not fully repriced what that means.",
    "The lenders' forecasts have shifted towards a hike. That is a change in expectations, not a confirmed RBA decision.",
  ],
  [
    "What the consensus got wrong was the assumption that a housing correction would force the RBA's hand. It will not.",
    "A housing correction alone does not determine the RBA's decision. The board also assesses inflation, employment and the wider economy.",
  ],
  [
    "Anyone waiting for Martin Place to blink because their equity is thinner is waiting for something that is not coming.",
    "Falling equity does not guarantee a rate cut; future decisions remain conditional on the economic evidence.",
  ],
  [
    "Another 25 basis points does not just lift repayments on existing debt, it shrinks the maximum loan a buyer can be approved for, which is the mechanism quietly setting prices at the top of the market.",
    "If lenders pass on a further 25 basis points, variable-rate repayments and new borrowing capacity can be affected. Existing fixed-rate terms are different, and this mechanism alone does not establish why property prices changed.",
  ],
  [
    "Confidence that low does not produce competitive auctions.",
    "Weak confidence may weigh on demand, but this survey alone does not establish auction competition.",
  ],
  [
    "Hauser's framing was close to a signal, and a hold now reads as a delay rather than a peak.",
    "Hauser's comments inform rate expectations, but a hold would not establish the direction of the following decision.",
  ],
  [
    "The cut everyone was waiting for is off the table, the next move is up, and a falling housing market will not change the RBA's mind.",
    "The cited lenders expect another hike. The next RBA decision remains uncertain, and weaker housing alone does not determine it.",
  ],
  [
    "Stress test your repayments for one more hike now while you have options, rather than after the November meeting when you do not.",
    "A repayment scenario can test exposure to a higher loan rate. Use the actual loan terms; neither a November hike nor the loss of refinancing options is certain.",
  ],
  [
    "The confirming signal is banks repricing fixed rates upward ahead of the RBA, which tells you the hike talk is real and not just forecasting cover.",
    "Banks' fixed-rate changes reflect funding costs and expectations. They do not confirm what the RBA will decide.",
  ],
  [
    "where a hold now reads as a delay rather than a peak",
    "where the decision and its explanation will update rate expectations",
  ],
  [
    "where Hauser's framing means a hold now reads as a delay rather than a peak in the cycle.",
    "where the board's decision and explanation will update rate expectations.",
  ],
  ["the print that decides whether November is a live hike", "one input to the November decision"],
  [
    "The cut everyone was waiting for is gone, the base case is now higher for longer, and a falling housing market will not rescue anyone, because the RBA has said plainly it does not target house prices and will not blink because equity got thinner.",
    "The cited lenders have moved towards a higher-for-longer forecast. The RBA does not target house prices, but that does not settle future decisions or guarantee the path of repayments.",
  ],
  [
    "Fewer completions plus migration still running near 301,000 does not loosen the rental market, it tightens it.",
    "The cited modelling describes a possible supply effect under its assumptions. It does not establish realised completions or the direction of local rents.",
  ],
  [
    "An oil shock that keeps imported inflation sticky can make the November call for the board without a single domestic number changing.",
    "An oil shock can affect inflation and funding costs, but it does not determine the November decision by itself.",
  ],
  [
    "That keeps a floor under both build costs and the value of homes that are already finished.",
    "Capacity constraints can put pressure on build costs. They do not guarantee a floor under existing-home prices.",
  ],
  [
    "That does not mean a crash, the supply constraints are too real.",
    "This does not establish whether prices will fall further; supply constraints alone cannot rule out a sharper decline.",
  ],
  [
    "The government wanted to shift the tax burden. It is getting a supply contraction instead.",
    "The cited modelling projects a supply contraction under its assumptions; it is not an observed outcome.",
  ],
  [
    "Fewer new dwellings plus record investor selling means softer prices in investor segments now and higher rents later, whichever side of the market you are on.",
    "The modelling raises a supply risk. Investor selling alone does not establish current price effects or future rent increases.",
  ],
  [
    "Fixed mortgage rates and bank funding costs are priced off global long rates, so an offshore oil shock can lift your repayments even if the cash rate holds.",
    "Global funding costs can affect newly offered mortgage rates. An existing fixed-rate repayment normally stays unchanged during its agreed term.",
  ],
  [
    "A structural squeeze on construction capacity puts a durable floor under both build costs and the scarcity value of existing homes, independent of the rate cycle.",
    "Construction constraints can put pressure on costs and delivery. They do not guarantee a price floor for existing homes.",
  ],
  [
    "If the government follows the mood and cuts migration, rental demand and underlying housing demand soften, compounding the correction already in train.",
    "A change in migration could affect housing demand, alongside household formation, supply and location. The size and price effect are not established here.",
  ],
] as const;

export const REVIEWED_EDITION_NOTICE = {
  issuedOn: "2026-09-18",
  reference: "Edition 17 · 7–13 September 2026",
  what: "Rate forecasts were presented too categorically, repayment effects were applied to all borrowers, and several housing effects were described as guaranteed outcomes.",
  now: "The website qualifies those statements, distinguishes fixed and variable loan terms, and keeps modelled outcomes separate from realised results. Previously distributed copies are not rewritten.",
  reviewSourceUrl: "https://moneysmart.gov.au/home-loans/choosing-a-home-loan",
};

export function correctReviewedEditionText<T>(value: T): T {
  if (typeof value === "string") {
    let result: string = value;
    for (const [before, after] of REPLACEMENTS) result = result.split(before).join(after);
    return result as T;
  }
  if (Array.isArray(value)) return value.map(correctReviewedEditionText) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, correctReviewedEditionText(item)])
    ) as T;
  return value;
}
