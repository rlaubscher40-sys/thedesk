/** Published copy versions are fixed release dates, never the visitor's date.
 * Preserve old newsletter wording here when changing the version: subscriber
 * records refer to it. A version is evidence of the notice, not legal approval.
 */
export const LEGAL_UPDATED_LABEL = "17 September 2026";
export const EDITORIAL_CONTACT = "ruben@thedesk.au";
export const NEWSLETTER_NOTICE_VERSION = "2026-09-14";
const NEWSLETTER_NOTICES = {
  "2026-09-14":
    "Subscribe to The Desk's free weekday morning briefing and Sunday edition. Confirm using the email we send you. Unsubscribe any time.",
} as const;
export const NEWSLETTER_NOTICE = NEWSLETTER_NOTICES[NEWSLETTER_NOTICE_VERSION];
