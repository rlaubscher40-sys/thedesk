import { hasHousingEvidence } from "./marketRelevance";

export function editorialCategory(title: string, summary: string, fallback: string): string {
  if (
    fallback === "PROPERTY" &&
    !hasHousingEvidence(`${title} ${summary}`) &&
    /\bvacan(?:t|cy|cies)\b/i.test(`${title} ${summary}`) &&
    /\b(?:jobs?|staff|positions?|departments?)\b/i.test(`${title} ${summary}`)
  )
    return "MACRO";
  if (fallback === "PROPERTY" && !hasHousingEvidence(title)) {
    const generalLiveBlog = /\b(?:news live|live updates|live blog)\b/i.test(title);
    const nonResidentialHousing =
      /\bhousing\s+(?:(?:suspected|potential)\s+)?(?:nuclear|weapons?|missiles?|military|reactors?|servers?|equipment)\b/i.test(
        summary
      );
    if (generalLiveBlog || (nonResidentialHousing && !hasHousingEvidence(summary))) return "OTHER";
  }
  const sports =
    /\b(football|soccer|premier league|champions league|rugby|cricket|tennis|grand prix|match report|full.time score)\b/i.test(
      title
    );
  const policy =
    /\b(government|sanctions|diploma(?:cy|tic)|parliament|election|legislation|foreign policy|war|military|state funding|housing)\b/i.test(
      `${title} ${summary}`
    );
  return sports && !policy && fallback === "GEOPOLITICS" ? "OTHER" : fallback;
}
