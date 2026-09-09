/** Fixed editorial labels only: never keep query text, a user ID or an arbitrary campaign. */
export const SOCIAL_CAMPAIGNS = [
  "bio",
  "daily",
  "weekly",
  "stat",
  "rent_comparison",
  "capital_rents",
  "supply_comparison",
  "rent_change",
  "before_buy",
  "other",
] as const;
export type SocialCampaign = (typeof SOCIAL_CAMPAIGNS)[number];
export function socialCampaign(
  arrival: { source: string; campaign: string | null } | null
): SocialCampaign | undefined {
  if (arrival?.source !== "instagram") return undefined;
  const value = arrival.campaign ?? "";
  if (value === "bio") return "bio";
  if (/^property_story_\d+$/.test(value) || value === "property_daily") return "daily";
  if (/^property_edition_\d+$/.test(value) || value === "property_weekly") return "weekly";
  const known: Record<string, SocialCampaign> = {
    property_market_data: "stat",
    property_editorial_reel: "rent_comparison",
    eight_capital_rents: "capital_rents",
    supply_comparison: "supply_comparison",
    sydney_rent_change: "rent_change",
    sydney_before_buy: "before_buy",
  };
  return Object.hasOwn(known, value) ? known[value] : "other";
}
