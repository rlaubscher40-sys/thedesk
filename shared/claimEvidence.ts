/** A bounded contradiction/unsupported-detail check, not a truth score.
 * Only original reporting is evidence. Passing does not establish entailment
 * of every sentence; generated copy never verifies another generated field. */
export type ClaimSource = { title: string; summary?: string | null; articleText?: string | null };
export type ClaimIssue =
  | "missing-evidence"
  | "unsupported-figure"
  | "unsupported-place"
  | "unsupported-date"
  | "delivery-status"
  | "forecast-as-fact"
  | "allegation-as-fact";

function figures(text: string): Set<string> {
  const normal = text.toLowerCase().replace(/(?<=\d),(?=\d{3}\b)/g, "");
  return new Set(
    [
      ...normal.matchAll(
        /(?<![\w.])([$€£])?\s*([+-]?\d+(?:\.\d+)?)\s*(billion\b|million\b|trillion\b|bn\b|[mbk]\b|thousand\b|%|percentage points?\b|basis points?\b|per cent\b|percent\b)?/g
      ),
    ].map((m) => {
      const unit = m[3] ?? "";
      const scale = /^(billion|bn|b)$/.test(unit)
        ? 1e9
        : /^(million|m)$/.test(unit)
          ? 1e6
          : /^(thousand|k)$/.test(unit)
            ? 1e3
            : unit === "trillion"
              ? 1e12
              : 1;
      const kind = /^(%|per cent|percent)$/.test(unit)
        ? "%"
        : /^(percentage point|basis point)/.test(unit)
          ? "pp"
          : (m[1] ?? "number");
      const value = (Number(m[2]) * scale) / (unit.startsWith("basis point") ? 100 : 1);
      return `${kind}:${Number(value.toPrecision(12))}`;
    })
  );
}
const placeGroups = [
  /\b(?:Sydney)\b/gi,
  /\bMelbourne\b/gi,
  /\bBrisbane\b/gi,
  /\bPerth\b/gi,
  /\bAdelaide\b/gi,
  /\bHobart\b/gi,
  /\bDarwin\b/gi,
  /\bCanberra\b/gi,
  /\b(?:NSW|New South Wales)\b/gi,
  /\b(?:VIC|Victoria)\b/gi,
  /\b(?:QLD|Queensland)\b/gi,
  /\b(?:WA|Western Australia)\b/g,
  /\b(?:SA|South Australia)\b/g,
  /\b(?:TAS|Tasmania)\b/gi,
];
const months =
  /\b(?:January|February|March|April|June|July|August|September|October|November|December)\b/gi;
const monthNames = (text: string) =>
  [
    ...(text.match(months) ?? []),
    ...(/\b(?:in|by|during|since|until|from) May\b|\bMay \d|\b\d{1,2} May\b/.test(text)
      ? ["May"]
      : []),
  ].map((s) => s.toLowerCase());
const delivered =
  /\b(?:(?:homes|dwellings|apartments) (?:have been |were |are now )?(?:built|completed|delivered)|(?:built|completed|delivered) (?:\d[\d,]* )?(?:new |social |affordable )*(?:homes|dwellings|apartments))\b/i;
const future =
  /\b(?:will|would|could|may|might|plans?|planned|planning|propos\w*|target\w*|aim\w*|expect\w*|forecast\w*|project\w*|modelling|modeling|if|once|not yet)\b/i;
const sentences = (text: string) => text.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);

export function checkClaimEvidence(
  copy: string | null | undefined,
  source: ClaimSource
): ClaimIssue[] {
  if (!copy?.trim()) return [];
  const evidence = `${source.title}\n${source.summary ?? ""}\n${source.articleText?.slice(0, 6000) ?? ""}`;
  if (!source.articleText?.trim() && !source.summary?.trim()) return ["missing-evidence"];
  const issues = new Set<ClaimIssue>();
  const known = figures(evidence);
  if ([...figures(copy)].some((n) => !known.has(n))) issues.add("unsupported-figure");
  for (const pattern of placeGroups) {
    pattern.lastIndex = 0;
    const mentioned = pattern.test(copy);
    pattern.lastIndex = 0;
    if (mentioned && !pattern.test(evidence)) issues.add("unsupported-place");
  }
  const knownMonths = new Set(monthNames(evidence));
  if (monthNames(copy).some((s) => !knownMonths.has(s))) issues.add("unsupported-date");
  const sourceSentences = sentences(evidence);
  for (const sentence of sentences(copy)) {
    if (delivered.test(sentence) && !future.test(sentence)) {
      const claimed = figures(sentence);
      if (
        !sourceSentences.some(
          (s) =>
            delivered.test(s) && !future.test(s) && [...claimed].every((n) => figures(s).has(n))
        )
      )
        issues.add("delivery-status");
    }
    const claimed = figures(sentence);
    if (
      claimed.size &&
      !future.test(sentence) &&
      !/\b(?:according to|estimat\w*|model|projection)\b/i.test(sentence)
    ) {
      const matching = sourceSentences.filter((s) => [...claimed].every((n) => figures(s).has(n)));
      if (matching.length && matching.every((s) => future.test(s))) issues.add("forecast-as-fact");
    }
    if (
      /\b(?:fraud|fraudulent|stole|stolen|illegal|unlawful)\b/i.test(sentence) &&
      /\b(?:alleged|alleges?|accused|suspected)\b/i.test(evidence) &&
      !/\b(?:alleged|alleges?|accused|suspected|if|whether)\b/i.test(sentence)
    )
      issues.add("allegation-as-fact");
  }
  return [...issues];
}

export function checkedContext<T extends Record<string, string | null>>(
  fields: T,
  source: ClaimSource
) {
  const held: Partial<Record<keyof T, ClaimIssue[]>> = {};
  const values = { ...fields };
  for (const field of Object.keys(fields) as Array<keyof T>) {
    const issues = checkClaimEvidence(fields[field], source);
    if (issues.length) {
      held[field] = issues;
      values[field] = null as T[keyof T];
    }
  }
  return { values, held };
}
