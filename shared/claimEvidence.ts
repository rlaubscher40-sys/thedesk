/** A bounded contradiction/unsupported-detail check, not a truth score.
 * Only original reporting is evidence. Passing does not establish entailment
 * of every sentence; generated copy never verifies another generated field. */
export type ClaimSource = { title: string; summary?: string | null; articleText?: string | null };
export type ClaimIssue =
  | "missing-evidence"
  | "unsupported-figure"
  | "figure-scope"
  | "period-scope"
  | "series-basis"
  | "figure-unit"
  | "proposal-as-fact"
  | "unsupported-place"
  | "unsupported-date"
  | "delivery-status"
  | "forecast-as-fact"
  | "cohort-scope"
  | "decision-authority"
  | "conditional-guidance"
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
  /\b(?:NT|Northern Territory)\b/g,
  /\b(?:ACT|Australian Capital Territory)\b/g,
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

const measures = [
  /\b(?:rents?|rental)\b/i,
  /\b(?:house|home|dwelling|property) (?:prices?|values?)\b/i,
  /\bunemployment\b/i,
  /\b(?:employment|employed)\b/i,
  /\bparticipation\b/i,
  /\b(?:wages?|WPI)\b/i,
  /\b(?:inflation|CPI)\b/i,
  /\bvacanc(?:y|ies)\b/i,
];
const cadences = [
  /\b(?:annual|annually|yearly|year.on.year|year to|year ending)\b/i,
  /\b(?:quarterly|quarter.on.quarter|quarter to|quarter ending)\b/i,
  /\b(?:monthly|month.on.month|month to|month ending)\b/i,
];
const bases = [/\btrend\b/i, /\bseasonally adjusted\b/i, /\b(?:original|unadjusted)\b/i];
function scopes(text: string, patterns: RegExp[]): number[] {
  return patterns.flatMap((pattern, index) => {
    pattern.lastIndex = 0;
    return pattern.test(text) ? [index] : [];
  });
}
function conflicts(a: string, b: string, patterns: RegExp[]) {
  const left = scopes(a, patterns),
    right = scopes(b, patterns);
  return left.length > 0 && right.length > 0 && !left.some((value) => right.includes(value));
}

/** Bind percentage figures to the original sentence's geography, measure,
 * cadence and adjustment. Global numeric overlap alone cannot verify them.
 * Ambiguous/unlabelled source sentences remain outside this bounded check. */
function percentageScopeIssues(copy: string, body: string[]): ClaimIssue[] {
  const issues = new Set<ClaimIssue>();
  for (const value of figures(copy)) {
    if (!value.startsWith("%:")) continue;
    const matching = body.filter((sentence) => figures(sentence).has(value));
    const mismatches = matching.map((sentence) => [
      ...(conflicts(copy, sentence, measures) || conflicts(copy, sentence, placeGroups)
        ? ["figure-scope" as const]
        : []),
      ...(conflicts(copy, sentence, cadences) ? ["period-scope" as const] : []),
      ...(conflicts(copy, sentence, bases) ? ["series-basis" as const] : []),
    ]);
    if (mismatches.length && mismatches.every((list) => list.length))
      mismatches.flat().forEach((issue) => issues.add(issue));
  }
  return [...issues];
}

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
  const years = (s: string) =>
    [...s.matchAll(/\b(?:over|across|during|within) (?:the )?(?:next )?(\d+) years?\b/gi)].map(
      (m) => m[1]!
    );
  const beneficiaries =
    /\b(?:assist|support|accommodate|serve)\w*\b.{0,90}\b(?:people|families|women|children|beneficiaries)\b/i;
  const housingPeriod = (s: string) =>
    /\b(?:homes|dwellings|apartments)\b/i.test(s) && !beneficiaries.test(s);
  const serviceYears = new Set(sourceSentences.filter((s) => beneficiaries.test(s)).flatMap(years));
  const institutionalAssets = new Set(
    sourceSentences
      .filter((s) => /APRA.*supervises institutions holding.*assets/i.test(s))
      .flatMap((s) => [...figures(s)].filter((n) => n.startsWith("$:")))
  );
  const paymentSavings = new Set(
    sourceSentences
      .filter((s) => /\b(?:lower|reduced) payment costs\b/i.test(s))
      .flatMap((s) => [...figures(s)].filter((n) => n.startsWith("$:")))
  );
  // A definitive headline cannot verify implementation when the reporting says draft.
  const planningBody = sentences(source.articleText?.slice(0, 6000) || source.summary || "");
  const planningProposal = planningBody.some(
    (s) =>
      /\b(?:propos\w*|draft|consultation)\b/i.test(s) &&
      /\b(?:height limits?|rezoning|development scheme|planning changes|amendments)\b/i.test(s)
  );
  const repealProposal =
    planningBody.some(
      (s) =>
        /\b(?:bill|legislation)\b/i.test(s) &&
        /\b(?:introduced|tabled|proposed|will repeal|would repeal)\b/i.test(s)
    ) &&
    planningBody.some((s) =>
      /\b(?:repeal|remove|abolish)\w*\b.{0,100}\b(?:obligations?|requirements?)\b/i.test(s)
    );
  const enactedRepeal = planningBody.some(
    (s) =>
      /\b(?:received royal assent|became law|has passed|was passed|was enacted)\b/i.test(s) &&
      /\b(?:repeal|remove|abolish)\w*\b/i.test(s)
  );
  for (const sentence of sentences(copy)) {
    // A profitable seller's holding period cannot explain the behaviour of
    // loss-making sellers. Require independent evidence for that conclusion.
    if (
      /\bprofitable\b/i.test(sentence) &&
      /\bmedian\b/i.test(sentence) &&
      /\b(?:means|shows|therefore|so)\b/i.test(sentence) &&
      /\b(?:most|majority of)\b.{0,40}\bloss.making\b.{0,70}\bshort\b/i.test(sentence) &&
      !/\b(?:does not|doesn't|cannot|can't|never) (?:mean|show|establish|imply)\b/i.test(
        sentence
      ) &&
      !planningBody.some((s) =>
        /\b(?:most|majority of)\b.{0,40}\bloss.making\b.{0,70}\bshort\b/i.test(s)
      )
    )
      issues.add("cohort-scope");
    // Preserve the distinction between the IPC's advice and the minister's
    // decision in the reviewed Town Hall planning process.
    if (
      /\b(?:IPC|Independent Planning Commission)\b.{0,35}\b(?:decides?|determines?|approves?)\b/i.test(
        sentence
      ) &&
      !/\b(?:not|never|doesn't|cannot|can't)\b/i.test(sentence) &&
      /\b(?:IPC|Independent Planning Commission)\b/i.test(evidence) &&
      /\badvice\b/i.test(evidence) &&
      /\b(?:my decision|minister.{0,50}(?:decid|decision))\b/i.test(evidence)
    )
      issues.add("decision-authority");
    // Conditional easing guidance must retain its inflation condition as well
    // as the growth condition; a separate reform recommendation is not a veto.
    const conditionalEasing =
      /\bIMF\b/i.test(evidence) &&
      planningBody.some(
        (s) => /\brate cuts?\b/i.test(s) && /\bif\b/i.test(s) && /\binflation\b/i.test(s)
      );
    if (
      conditionalEasing &&
      ((/\brate cuts?\b/i.test(sentence) &&
        /\b(?:should|could|consider)\w*\b/i.test(sentence) &&
        /\bgrowth\b/i.test(sentence) &&
        !/\binflation\b/i.test(sentence)) ||
        (/\brate (?:relief|cuts?)\b.{0,45}\b(?:depends? on|requires?)\b.{0,35}\b(?:structural )?reform\b/i.test(
          sentence
        ) &&
          !/\b(?:does not|doesn't|never) (?:depend|require)\b/i.test(sentence)))
    )
      issues.add("conditional-guidance");
    percentageScopeIssues(sentence, planningBody).forEach((issue) => issues.add(issue));
    if (
      repealProposal &&
      !enactedRepeal &&
      /\b(?:obligations?|requirements?)\b/i.test(sentence) &&
      /\b(?:stripped|removed|repealed|abolished|ended|lifting|removing|repealing)\b/i.test(
        sentence
      ) &&
      !/\b(?:propos\w*|would|could|if|will|to be|not yet|has not|hasn't|bill to|legislation to)\b/i.test(
        sentence
      )
    )
      issues.add("proposal-as-fact");
    if (
      planningProposal &&
      (/\b(?:rezoned|(?:after|following|with) rezoning)\b/i.test(sentence) ||
        (/\b(?:height limits?|rezoning|development scheme|planning changes|amendments)\b/i.test(
          sentence
        ) &&
          (/\b(?:already|now|just had|has been|have been|was|were)\b.{0,70}\b(?:lifted|raised|increased|approved|implemented|enacted)\b/i.test(
            sentence
          ) ||
            /\bheight limits?\b.{0,30}\b(?:lifted|raised|increased|approved)\b/i.test(
              sentence
            )))) &&
      !/\b(?:propos\w*|draft|would|could|if|to be|will be|may be)\b|\b(?:not|never)\s+(?:yet\s+)?(?:been\s+)?(?:rezoned|raised|lifted|increased|approved|implemented|enacted)\b/i.test(
        sentence
      ) &&
      !planningBody.some((s) => s.trim() === sentence.trim() && !future.test(s))
    )
      issues.add("proposal-as-fact");
    // Do not collapse a reported combination of rates and loan size into a
    // rates-only repayment effect. Mere numeric overlap does not prove causation.
    if (
      /\brepayments?\b/i.test(sentence) &&
      /\brate (?:rises?|increases?|hikes?)\b/i.test(sentence) &&
      /\b(?:average|larger|higher|bigger|increased) (?:home )?loan (?:size|amount)\b/i.test(
        evidence
      ) &&
      /\b(?:combined|combination|together|alongside)\b/i.test(evidence) &&
      !/\bloan (?:size|amount)|\blarger (?:loans?|borrowing)\b/i.test(sentence) &&
      [...figures(sentence)].some((n) => n.startsWith("$:"))
    )
      issues.add("figure-scope");
    if (
      /\byears (?:away|from (?:settlement|completion|delivery))\b/i.test(sentence) &&
      !/\byears (?:away|from (?:settlement|completion|delivery))\b/i.test(evidence)
    )
      issues.add("period-scope");
    if (
      /\b(?:almost certainly|structurally finished|guaranteed to|will definitely)\b/i.test(
        sentence
      ) &&
      !sourceSentences.some((s) => s.includes(sentence))
    )
      issues.add("forecast-as-fact");
    if (
      /\bsurcharge (?:revenue|income)\b/i.test(sentence) &&
      !/\b(?:savings?|lower payment costs|reduced payment costs)\b/i.test(sentence) &&
      [...figures(sentence)].some((n) => paymentSavings.has(n))
    )
      issues.add("figure-scope");
    if (
      housingPeriod(sentence) &&
      years(sentence).some(
        (y) =>
          serviceYears.has(y) &&
          !sourceSentences.some((s) => housingPeriod(s) && years(s).includes(y))
      )
    )
      issues.add("period-scope");
    for (const match of sentence.matchAll(/\b(\d[\d,]*)\s+(?:new )?beds\b/gi)) {
      const count = match[1]!.replace(/,/g, "");
      if (
        !new RegExp(`\\b${count}\\s+(?:new )?beds\\b`, "i").test(
          evidence.replace(/(?<=\d),(?=\d)/g, "")
        )
      )
        issues.add("figure-unit");
    }
    if (
      /\b(?:propos\w*|non.binding|party plan)\b/i.test(evidence) &&
      /\b(?:visas?|migration|short.stay|levy|review)\b/i.test(sentence) &&
      /\b(?:enacted|now law|takes effect|compulsory|mandatory|has (?:cut|banned)|will (?:cut|ban|remove))\b/i.test(
        sentence
      ) &&
      !/\b(?:propos\w*|would|if|non.binding|party plan)\b/i.test(sentence) &&
      !sourceSentences.some((s) => s.includes(sentence))
    )
      issues.add("proposal-as-fact");
    if (
      /\b(?:superannuation|super funds?|retirement)\b/i.test(sentence) &&
      !/\b(?:regulated|supervised) institutions\b|\bdepositors\b.*\bpolicyholders\b/i.test(
        sentence
      ) &&
      [...figures(sentence)].some((n) => institutionalAssets.has(n))
    )
      issues.add("figure-scope");
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
