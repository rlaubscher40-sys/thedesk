/** Publisher authority and a fresh date do not make every page a news event.
 * Match the page's main purpose, without borrowing significance from the body. */
export function nonNewsFormatHold(input: {
  title: string;
  summary?: string | null;
}): string | null {
  const title = input.title.trim();
  const text = `${title} ${input.summary ?? ""}`;
  const publicConsequence =
    /\b(?:court|tribunal|ruling|fraud|scam|compensation|rights|law|legislation|compulsory acquisition)\b/i.test(
      title
    );
  if (
    !publicConsequence &&
    (/\b(?:couple|family|owner|homeowner|man|woman)\b.{0,85}\b(?:lists?|selling|sells?|downsizing|downsize)\b.{0,85}\b(?:home|house|mansion|apartment|property)\b/i.test(
      title
    ) ||
      /\b(?:couple|family|owner|homeowner)\b.{0,30}\blists?\b.{0,100}\b(?:downsize|downsizing)\b/i.test(
        title
      ) ||
      /^how (?:a |one |former )?(?:renter|couple|family|man|woman)\b.{0,60}\b(?:built|converted|renovated)\b.{0,60}\b(?:home|house|cottage)\b/i.test(
        title
      ))
  )
    return "individual-property-promotion";
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
