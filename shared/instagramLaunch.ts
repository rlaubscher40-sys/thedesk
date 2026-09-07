/** Reviewed editorial slots. Clients select a slot, never supply publishing content. */
export const LAUNCH_POST_IDS = ["start", "comparison", "how"] as const;
export type LaunchPostId = (typeof LAUNCH_POST_IDS)[number];
export const LAUNCH_POST_LABELS: Record<LaunchPostId, string> = {
  start: "Start here",
  comparison: "Brisbane vs Perth",
  how: "How to use The Desk",
};
