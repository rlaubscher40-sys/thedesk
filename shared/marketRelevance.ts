/** Conservative topic gate, shared by SQL selection and literal passage checks.
 * A city mention or a PROPERTY category alone is not housing evidence.
 * Keep infrastructure and general city news out unless housing is discussed.
 * This is a retrieval filter, not a certification of a source's claims.
 */
export const HOUSING_TOPIC_PATTERN =
  "(^|[^a-z])(housing|rents?|rental|vacancy|vacancies|dwellings?|mortgages?|rezoning|zoning|subdivid(e|ed|ing|ision|isions)|negative gearing|first.home buyers?|home loans?|residential (construction|supply|approvals|development)|building approvals|auction clearance|(house|home|property|apartment|unit|land) (prices?|values?|sales?|markets?|supply|affordability|investors?|investment))([^a-z]|$)";
export function hasHousingEvidence(text: string): boolean {
  return new RegExp(HOUSING_TOPIC_PATTERN, "i").test(text.replace(/\s+/g, " "));
}
