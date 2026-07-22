/**
 * Lead magnets — gated resources a visitor trades their email for. Shared
 * between the client (renders the /free/:slug landing page) and the server
 * (validates the slug, sends the delivery email, redirects to the asset on
 * confirm) so the two can't drift.
 *
 * How the flow works:
 *   1. Visitor lands on /free/<slug>, enters their email.
 *   2. subscribers.requestLeadMagnet upserts them (source "magnet:<slug>")
 *      and emails a confirm link pointing at /api/magnet/<slug>?token=…
 *   3. Clicking that link confirms the subscriber (double opt-in, so the
 *      list stays clean) AND redirects them to `deliveryUrl` — the wanting
 *      of the asset is the confirm incentive, which is the whole trick.
 *
 * To add a magnet: drop the asset somewhere reachable (a PDF in
 * client/public/magnets/, or an external link), then add an entry here.
 * `deliveryUrl` is where a confirmed subscriber is sent to get it.
 *
 * The seed entry below is a PLACEHOLDER so the flow is live end-to-end.
 * Replace its copy and drop the real file at its deliveryUrl before you
 * point traffic at it.
 */

export type LeadMagnet = {
  /** URL slug: /free/<slug> and source tag "magnet:<slug>". Lowercase,
   *  hyphens only — it ends up in a URL and an attribution string. */
  slug: string;
  /** Headline on the landing page and the delivery email. */
  title: string;
  /** One-line promise under the title. */
  tagline: string;
  /** A short paragraph of context. */
  description: string;
  /** What's inside — 3 to 5 concrete, specific lines. */
  bullets: readonly string[];
  /** Where a confirmed subscriber is sent to get the asset. A path served
   *  from client/public (e.g. "/magnets/act-hotspots.pdf") or an absolute
   *  external URL. */
  deliveryUrl: string;
  /** Button label, e.g. "the report", "the cheat sheet". */
  assetNoun: string;
};

export const LEAD_MAGNETS: readonly LeadMagnet[] = [
  {
    slug: "hotspots",
    title: "The Australian Hotspots Shortlist",
    tagline: "The suburbs the numbers are pointing at right now.",
    description:
      "A plain-English shortlist of the markets where the fundamentals are lining up this quarter, with the one metric that put each on the list. The same read that runs behind The Desk, on a single page.",
    bullets: [
      "The markets with tightening supply and rising enquiry, ranked",
      "The single number that flagged each one",
      "What would take a market off the list",
      "How to read it without a data subscription",
    ],
    // PLACEHOLDER: drop the real PDF at client/public/magnets/hotspots.pdf
    // (or change this to an external link) before pointing traffic here.
    deliveryUrl: "/magnets/hotspots.pdf",
    assetNoun: "the shortlist",
  },
];

export function getLeadMagnet(slug: string): LeadMagnet | undefined {
  return LEAD_MAGNETS.find((m) => m.slug === slug);
}
