/** This APRA paragraph describes the regulator's entire remit, not the
 * subject of an individual release. Keep it out of extracted story evidence. */
export function isInstitutionalBoilerplate(text: string): boolean {
  return (
    /^The Australian Prudential Regulation Authority \(APRA\) is the prudential regulator of the financial services industry\./i.test(
      text.trim()
    ) && /APRA currently supervises institutions holding/i.test(text)
  );
}
