/**
 * Where a visitor came from, remembered until they subscribe.
 *
 * The site already records a referrer hostname per page view, and the
 * subscribers table already has a `source` column — but that column stores the
 * *placement* that converted them ("first-visit-modal", "edition-footer"), not
 * their origin. So Instagram and Google subscribers are indistinguishable, and
 * "has Instagram produced a single subscriber" has never been answerable.
 *
 * This closes that gap. The arrival is worked out once, on the first page of a
 * session, and held in sessionStorage so it survives the several navigations
 * between landing and actually subscribing. Both facts are then sent on
 * subscribe: placement (which form) and arrival (which channel).
 *
 * ## Why the campaign parameter matters more than the referrer
 *
 * Instagram's in-app browser frequently sends no `Referer` at all, so
 * referrer-based attribution silently files that traffic as "direct" and
 * undercounts the channel we most want to measure. A tagged link is the only
 * reliable signal, which is why a campaign parameter always wins over the
 * referrer when both are present.
 *
 * Note that until now a tagged link would not have survived anyway: the page
 * tracker reads `location.pathname` and drops the query string, so any UTM on
 * the Instagram bio link has been discarded on arrival.
 *
 * ## Privacy
 *
 * The existing tracker deliberately stores a referrer *hostname* and never a
 * full URL, because full URLs leak identifiers. This keeps that rule: only a
 * fixed whitelist of campaign keys is ever read, values are truncated and
 * lower-cased, and nothing else from the query string is retained anywhere.
 */

/** The only query keys ever read. Anything else in the URL is ignored, so a
 *  link carrying a token or an email cannot leak into storage or the database. */
const CAMPAIGN_KEYS = ["utm_source", "ref"] as const;
const CAMPAIGN_NAME_KEYS = ["utm_campaign", "utm_medium"] as const;

const STORAGE_KEY = "thedesk:arrival";

/** Values are short slugs; anything longer is a mistake or an attack. */
const MAX_LEN = 48;

export type Arrival = {
  /** Channel slug: "instagram", "linkedin", "google", "direct", … */
  source: string;
  /** Campaign name when the link carried one, else null. */
  campaign: string | null;
};

/** Hostnames we care enough about to name, so the admin reads as channels
 *  rather than a list of link-shortener domains. Longest match wins. */
const HOST_CHANNELS: Array<[RegExp, string]> = [
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)l\.instagram\.com$/, "instagram"],
  [/(^|\.)linkedin\.com$/, "linkedin"],
  [/(^|\.)lnkd\.in$/, "linkedin"],
  [/(^|\.)substack\.com$/, "substack"],
  [/(^|\.)t\.co$/, "x"],
  [/(^|\.)(twitter|x)\.com$/, "x"],
  [/(^|\.)facebook\.com$/, "facebook"],
  [/(^|\.)fb\.me$/, "facebook"],
  [/(^|\.)reddit\.com$/, "reddit"],
  [/(^|\.)news\.google\.com$/, "google-news"],
  [/(^|\.)google\./, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
];

/** Lower-case, strip anything not slug-safe, truncate. Keeps a hand-typed or
 *  hostile campaign value from becoming an oversized or injected string. */
function slug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LEN);
}

/** Map a referrer hostname onto a channel name, or the bare hostname when we
 *  have no opinion about it. */
export function channelForHost(host: string): string {
  const clean = host.replace(/^www\./, "").toLowerCase();
  for (const [pattern, name] of HOST_CHANNELS) {
    if (pattern.test(clean)) return name;
  }
  return slug(clean) || "direct";
}

/**
 * Work out the arrival from a referrer and a query string.
 *
 * Pure, so the classification is testable without a DOM. `ownHost` marks
 * same-origin navigation as internal: a visitor moving between our own pages
 * has not "arrived from" anywhere, and treating that as a referral would file
 * most of the site's traffic under its own name.
 */
export function parseArrival(referrer: string, search: string, ownHost?: string): Arrival {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  let campaign: string | null = null;
  for (const key of CAMPAIGN_NAME_KEYS) {
    const raw = params.get(key);
    if (raw) {
      campaign = slug(raw) || null;
      if (campaign) break;
    }
  }

  // A tagged link is the strongest signal we get, and the only one that
  // survives an in-app browser that sends no referrer.
  for (const key of CAMPAIGN_KEYS) {
    const raw = params.get(key);
    const tagged = raw ? slug(raw) : "";
    if (tagged) return { source: tagged, campaign };
  }

  let host = "";
  try {
    host = referrer ? new URL(referrer).hostname : "";
  } catch {
    host = "";
  }
  if (!host) return { source: "direct", campaign };
  if (ownHost && host.replace(/^www\./, "") === ownHost.replace(/^www\./, "")) {
    return { source: "internal", campaign };
  }
  return { source: channelForHost(host), campaign };
}

function readStored(): Arrival | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Arrival>;
    if (typeof parsed?.source !== "string" || !parsed.source) return null;
    return { source: parsed.source, campaign: parsed.campaign ?? null };
  } catch {
    // Private mode, blocked storage, or a corrupt value. Not knowing where
    // someone came from must never break the page they came to.
    return null;
  }
}

/**
 * Record the arrival for this session, once.
 *
 * Called on app boot. Later calls are no-ops, which is the point: by the time
 * someone reaches the subscribe form they are several navigations deep and
 * their referrer is our own site, so only the first observation is true.
 *
 * An arrival that resolves to "internal" is not stored — that only happens on
 * a same-origin entry we have no origin for, and storing it would overwrite
 * nothing useful with something actively misleading.
 */
export function captureArrival(): Arrival | null {
  if (typeof window === "undefined") return null;
  const existing = readStored();
  if (existing) return existing;

  const arrival = parseArrival(
    document.referrer || "",
    window.location.search || "",
    window.location.hostname
  );
  if (arrival.source === "internal") return null;

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(arrival));
  } catch {
    // Storage unavailable. The arrival is still returned for this page, it
    // just won't survive to the subscribe form.
  }
  return arrival;
}

/** The stored arrival, for the subscribe forms to send. Null when storage is
 *  unavailable or this session was never captured. */
export function getArrival(): Arrival | null {
  if (typeof window === "undefined") return null;
  return readStored();
}
