/** Conservative subject gate, shared by SQL candidate selection and local passages.
 * Generic "home", "market" and "prices" also occur in sport and are deliberately absent.
 * This is retrieval eligibility, not proof that a claim is supported.
 */
export const HOUSING_PATTERN =
  "(^|[^a-z])(housing|property (markets?|prices?|values?|reports?|invest[a-z]*|supply|demand|sector|tax[a-z]*|sales?)|properties (for sale|sold|listed)|residential|dwelling(s)?|rents?|rental(s)?|vacanc(y|ies)|mortgage(s)?|home prices?|house prices?|home values?|house values?|building approvals?|housing completions?|population|migration)([^a-z]|$)";
export function hasHousingEvidence(text: string): boolean {
  return new RegExp(HOUSING_PATTERN, "i").test(text);
}
