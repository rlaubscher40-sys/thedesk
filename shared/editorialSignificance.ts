/** Ranking is an editorial preference, never a publication or truth check.
 * Use the headline's subject: background paragraphs and generated takeaways
 * must not turn a product launch into a major policy development. */
export function storySignificance(title: string): { reason: string; baseline: number } {
  const headline = title.trim();
  const result = (reason: string, baseline: number) => ({ reason, baseline });
  // Predictions and commentary remain useful, but do not establish an event.
  if (
    /\?|\b(?:could|might|would|should|expects?|expected|predict\w*|forecast\w*|calls? for|urges?|opinion)\b|\bmay (?:be|cut|rise|fall|hold|raise|deliver|build)\b/i.test(
      headline
    )
  )
    return result("analysis-or-proposal", 74);

  if (
    /\b(?:partners? with|teams? up with|partnership|white.label|product launch|launches? (?:a |new )?(?:loan|product|platform)|diversity,? equity|DE&I)\b/i.test(
      headline
    )
  )
    return result("industry-or-product-news", 66);

  const housing =
    /\b(?:hous(?:e|es|ing)|homes?|dwellings?|property|properties|residential|rents?|rental|tenan\w*|mortgage|builder|developer|construction)\b/i;
  if (
    /\b(?:RBA|Reserve Bank(?: of Australia)?)(?: board)? (?:cuts?|raises?|holds?|hikes?) (?:the )?(?:cash |interest )?rates?\b/i.test(
      headline
    ) ||
    /^cash rate (?:held|raised|cut|unchanged|remains unchanged)\b/i.test(headline) ||
    (/\b(?:legislation|bill|levy|laws?|reforms?|tax|stamp duty|negative gearing|capital gains|lending standards)\b/i.test(
      headline
    ) &&
      /\b(?:passes?|passed|enacted|reject\w*|votes? down|shelv\w*|ditch\w*|abolish\w*|takes? effect|comes? into (?:force|effect))\b/i.test(
        headline
      ))
  )
    return result("policy-decision", 90);

  if (
    /\b(?:fraud|fraudulent|defrauded|arrests?|charged|collapse[sd]?|insolven\w*|administration|liquidation|stood down)\b/i.test(
      headline
    ) &&
    (housing.test(headline) ||
      /\b(?:banks?|loans?|lending|ASIC|advisers?|accountants?)\b/i.test(headline))
  )
    return result("financial-or-housing-disruption", 88);

  const metric =
    /\b(?:values?|prices?|approvals?|completions?|vacanc(?:y|ies)|rents?|inflation|unemployment|wages?|GDP|consumer confidence)\b/i;
  if (
    metric.test(headline) &&
    /\b(?:falls?|fell|rises?|rose|rising|drops?|dropped|declines?|declining|slows?|grows?|grew|hits?|reaches?|record (?:low|high)|first quarterly fall)\b/i.test(
      headline
    ) &&
    (housing.test(headline) ||
      /\b(?:inflation|unemployment|wages?|GDP|consumer confidence)\b/i.test(headline))
  )
    return result("market-data-development", 88);

  if (
    /\b[0-9][0-9,]* (?:new |social |affordable )*(?:homes|dwellings|apartments)\b/i.test(
      headline
    ) ||
    (housing.test(headline) &&
      /\b(?:DA approval|approval granted|rezoning approved|construction begins|homes delivered|planning approval|rental reforms? enacted)\b/i.test(
        headline
      ))
  )
    return result("housing-supply-development", 84);

  return result("relevant-reporting", 74);
}
