export class CaptionStyleError extends Error {}

/** Shared publishing rule, including manual captions and every Instagram format. */
export function assertCaptionStyle(caption: string): string {
  if (!caption.trim() || caption.length > 2200)
    throw new CaptionStyleError(
      "Caption must contain text and fit 2,200 characters; no factual truncation allowed."
    );
  const withoutUrls = caption.replace(/https?:\/\/\S+/g, "");
  const tags = withoutUrls.match(/(?:^|\s)#[\p{L}\p{N}_]+/gu) ?? [];
  if (tags.length > 5) throw new CaptionStyleError("Caption needs at most five relevant hashtags.");
  if (
    /\b(?:comment\s+["']?(?:yes|done)|tag\s+(?:three|3|five|5)\s+friends|like\s+and\s+share)\b/i.test(
      withoutUrls
    )
  )
    throw new CaptionStyleError("Caption needs a useful reader action, not engagement bait.");
  if (caption.includes("\u2014"))
    throw new CaptionStyleError(
      "Caption needs editing: use a comma or full stop instead of an em dash."
    );
  // Check common American prose spellings without changing source URLs, handles,
  // hashtags, numbers or proper names. This is a backstop, not a full grammar checker.
  const prose = caption.replace(/https?:\/\/\S+|[@#][\w-]+/g, "");
  const american = prose.match(
    /\b(?:colors?|colored|colorful|behaviors?|neighborhoods?|neighbors?|center|centers|centered|analyze|analyzed|analyzing|organize|organized|organizing|organization|organizations|recognize|recognized|recognizing|realize|realized|realizing|optimize|optimized|optimizing|optimization|favorite|favorites|traveling|traveled)\b/
  );
  if (american)
    throw new CaptionStyleError(`Caption needs Australian English: review "${american[0]}".`);
  return caption;
}
