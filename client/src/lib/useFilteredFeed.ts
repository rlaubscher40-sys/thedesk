/**
 * Filters a list of feed items through the user's topic-allowlist
 * preference. Centralised so every surface that consumes feed items
 * (Today, Today-in-brief, TodaysTopics rail, LiveTicker, Archive
 * overview, search results) gets the same gate without each component
 * having to know about UserPrefs.
 *
 * When the user hasn't opted into any topics this is a no-op pass-through.
 */
import { useMemo } from "react";
import { useUserPrefs } from "./userPrefs";

type WithCategory = { category: string };

export function useFilteredFeed<T extends WithCategory>(items: T[]): T[] {
  const { isCategoryAllowed } = useUserPrefs();
  return useMemo(
    () => items.filter((it) => isCategoryAllowed(it.category)),
    [items, isCategoryAllowed]
  );
}
