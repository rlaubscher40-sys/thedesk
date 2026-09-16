/** A crawler omitting Accept or accepting any media type can read HTML.
 * Respect a more-specific text/html;q=0 exclusion even alongside */
export function acceptsHtml(accept?: string): boolean {
  if (!accept?.trim()) return true;
  const ranges = accept
    .toLowerCase()
    .split(",")
    .map((part, order) => {
      const [type, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const quality = q === undefined ? 1 : Number(q.slice(2));
      return {
        specificity: type === "text/html" ? 2 : type === "text/*" ? 1 : type === "*/*" ? 0 : -1,
        quality,
        order,
      };
    })
    .filter((r) => r.specificity >= 0)
    .sort((a, b) => b.specificity - a.specificity || a.order - b.order);
  const match = ranges[0];
  return !!match && Number.isFinite(match.quality) && match.quality > 0 && match.quality <= 1;
}
