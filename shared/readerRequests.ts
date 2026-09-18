/**
 * Coverage requests: a reader asking The Desk to *report* something.
 *
 * This extends the existing feedback inbox rather than adding a third form.
 * Ask answers from evidence The Desk already holds; a coverage request is the
 * other case — the reader wants reporting that does not exist yet.
 *
 * Privacy rules, enforced here and in the router:
 *  - A submission is private. Nothing on this path is published automatically,
 *    ever. What gets published is reporting an editor wrote, linked back to the
 *    request it answered.
 *  - Contact details are for replying to that reader and nothing else. They are
 *    admin-only, never leave the inbox, and are not required to submit.
 *  - Categorisation is a fixed list, not free text, so triage never turns into a
 *    second store of whatever someone typed about a person or an address.
 *  - A published answer must be a Desk page. The inbox cannot be used to get an
 *    arbitrary outbound link onto the site.
 */

export const REQUEST_TOPICS = [
  { key: "supply", label: "Housing supply and construction" },
  { key: "rents", label: "Rents and renting" },
  { key: "prices", label: "Prices and sales" },
  { key: "lending", label: "Lending, rates and borrowing" },
  { key: "policy", label: "Policy, planning and tax" },
  { key: "population", label: "Population and migration" },
  { key: "data", label: "How a number is measured" },
  { key: "other", label: "Something else" },
] as const;

export const REQUEST_GEOGRAPHIES = [
  { key: "national", label: "Australia" },
  { key: "nsw", label: "New South Wales" },
  { key: "vic", label: "Victoria" },
  { key: "qld", label: "Queensland" },
  { key: "wa", label: "Western Australia" },
  { key: "sa", label: "South Australia" },
  { key: "tas", label: "Tasmania" },
  { key: "act", label: "Australian Capital Territory" },
  { key: "nt", label: "Northern Territory" },
  { key: "unspecified", label: "Not about one place" },
] as const;

/**
 * The same three reader positions the voice rules already use. A coverage
 * request is more useful to an editor when it says which decision it serves.
 */
export const READER_TASKS = [
  { key: "buying", label: "Buying" },
  { key: "holding", label: "Holding" },
  { key: "watching", label: "Watching" },
] as const;

export type RequestTopic = (typeof REQUEST_TOPICS)[number]["key"];
export type RequestGeography = (typeof REQUEST_GEOGRAPHIES)[number]["key"];
export type ReaderTask = (typeof READER_TASKS)[number]["key"];

export const REQUEST_TOPIC_KEYS = REQUEST_TOPICS.map((topic) => topic.key);
export const REQUEST_GEOGRAPHY_KEYS = REQUEST_GEOGRAPHIES.map((place) => place.key);
export const READER_TASK_KEYS = READER_TASKS.map((task) => task.key);

/**
 * Where a request can end up. "declined" is a real outcome and is recorded, so
 * the inbox shows what was considered and set aside rather than only what ran.
 */
export const REQUEST_OUTCOMES = ["new", "reviewed", "answered", "declined"] as const;

function labelFor<T extends { key: string; label: string }>(
  list: readonly T[],
  key: string | null | undefined
): string | null {
  return list.find((item) => item.key === key)?.label ?? null;
}

export const requestTopicLabel = (key?: string | null) => labelFor(REQUEST_TOPICS, key);
export const requestGeographyLabel = (key?: string | null) => labelFor(REQUEST_GEOGRAPHIES, key);
export const readerTaskLabel = (key?: string | null) => labelFor(READER_TASKS, key);

/**
 * Desk pages a published answer may point at. Same-site, no scheme, no host, no
 * protocol-relative "//evil.example", no query or fragment smuggling, and only
 * the route shapes that actually carry published reporting.
 */
const ANSWER_ROUTES: RegExp[] = [
  /^\/story\/[1-9][0-9]{0,9}$/,
  /^\/editions\/[1-9][0-9]{0,9}$/,
  /^\/guides\/[a-z][a-z0-9-]{0,63}$/,
  /^\/analysis\/[a-z][a-z0-9-]{0,63}$/,
  /^\/markets\/[a-z][a-z0-9-]{0,63}$/,
  /^\/projects$/,
];

export function publishedAnswerPath(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 512) return null;
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  if (/[?#\s\\]/.test(trimmed)) return null;
  return ANSWER_ROUTES.some((route) => route.test(trimmed)) ? trimmed : null;
}

export type ReaderRequest = {
  id: number;
  topic: string | null;
  geography: string | null;
  readerTask: string | null;
  status: string;
  answerUrl: string | null;
  createdAt: Date | string;
};

export type RequestTally = { key: string; label: string; count: number };

/**
 * Counts for editorial triage, in the order the fixed lists declare — not by
 * size, so a quiet topic stays visible instead of disappearing off the bottom.
 * Unrecognised or missing values are counted under "Not categorised" rather
 * than dropped, so the totals always add up to the number of requests.
 */
export function tallyRequests(
  requests: ReaderRequest[],
  dimension: "topic" | "geography" | "readerTask"
): RequestTally[] {
  const list =
    dimension === "topic"
      ? REQUEST_TOPICS
      : dimension === "geography"
        ? REQUEST_GEOGRAPHIES
        : READER_TASKS;
  const counts = new Map<string, number>();
  let uncategorised = 0;
  for (const request of requests) {
    const value = request[dimension];
    if (typeof value === "string" && list.some((item) => item.key === value))
      counts.set(value, (counts.get(value) ?? 0) + 1);
    else uncategorised += 1;
  }
  const tallies: RequestTally[] = list
    .map((item) => ({ key: item.key, label: item.label, count: counts.get(item.key) ?? 0 }))
    .filter((tally) => tally.count > 0);
  if (uncategorised > 0)
    tallies.push({ key: "uncategorised", label: "Not categorised", count: uncategorised });
  return tallies;
}

/**
 * What an editor should look at first: requests with no outcome yet, oldest
 * first, so nothing sits in the inbox indefinitely because newer items keep
 * arriving on top of it.
 */
export function triageQueue(requests: ReaderRequest[]): ReaderRequest[] {
  return requests
    .filter((request) => request.status === "new")
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/**
 * The only shape of a request that may ever leave the inbox: its categories and
 * its outcome. No message text, no contact details, no page URL, no user agent,
 * no timestamp precise enough to single someone out.
 *
 * Even this is not published automatically anywhere; it exists so that if The
 * Desk ever does say what readers are asking about, it cannot accidentally say
 * who asked or what they typed.
 */
export function publicRequestShape(request: ReaderRequest): {
  topic: string | null;
  geography: string | null;
  readerTask: string | null;
  answered: boolean;
  answerUrl: string | null;
} {
  const answerUrl = request.status === "answered" ? publishedAnswerPath(request.answerUrl) : null;
  return {
    topic: requestTopicLabel(request.topic),
    geography: requestGeographyLabel(request.geography),
    readerTask: readerTaskLabel(request.readerTask),
    answered: answerUrl !== null,
    answerUrl,
  };
}

/** Shown wherever a reader is asked to submit one. Plain, and binding. */
export const REQUEST_PRIVACY_NOTICE =
  "Your request goes to The Desk's editors, not to a public page. Nothing you write here is published, and an email address is optional and used only to reply to you. Please do not send anyone's personal details, or an allegation about a named person or business — The Desk cannot verify or publish those from a form.";

/**
 * The disclosed basis for using anything a reader typed. Ask questions are a
 * different path with a different expectation, and are not folded into this one.
 */
export const REQUEST_USE_BASIS =
  "Editors read every request to decide what to report. A request may lead to published reporting, but the reporting is written from sources The Desk can cite — never from your words, and never attributed to you. Questions typed into Ask are answered for you at the time and are not treated as coverage requests.";
