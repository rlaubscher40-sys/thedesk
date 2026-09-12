/** Publisher authority and a fresh date do not make every page a news event.
 * Match the page's main purpose, without borrowing significance from the body. */
export function nonNewsFormatHold(input: {
  title: string;
  summary?: string | null;
}): string | null {
  const title = input.title.trim();
  const text = `${title} ${input.summary ?? ""}`;
  if (
    /\b(?:book|reserve|buy)\s+(?:your |an? |the )?(?:exhibit table|booth|tickets?|conference pass)\b/i.test(
      text
    ) ||
    /\b(?:last chance|final call)\b.{0,100}\b(?:apply to host|side events?|register|tickets?)\b/i.test(
      text
    ) ||
    /\bapply to host an? (?:official )?(?:side )?event\b/i.test(text)
  )
    return "event-booking-promotion";
  if (
    /\b(?:home ?buyer|couple|family|woman|man|buyer)\b.{0,60}\b(?:scores?|snaps? up|buys|bought|wins|lands?)\b.{0,60}\b(?:cottage|mansion|house|home|apartment|property)\b/i.test(
      title
    ) &&
    !/\b(?:court|tribunal|ruling|fraud|scam|compensation|rights|law|legislation)\b/i.test(title)
  )
    return "individual-property-purchase";
  if (
    /\b(?:how (?:can|do|to)|tips (?:for|to)|ways to)\b.{0,90}\b(?:improve your chances|rental application|secure a rental|get(?:ting)? a lease)\b/i.test(
      title
    ) &&
    !/\b(?:new laws?|reforms?|privacy|discrimination|ban|rights|regulat\w*)\b/i.test(title)
  )
    return "rental-application-guide";
  return null;
}
