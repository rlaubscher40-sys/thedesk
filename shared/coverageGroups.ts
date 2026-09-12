import { conflictingEvents } from "./storyEvent";
import type { SourceTiming } from "./sourceTiming";

type GroupStory = {
  id: number;
  title: string;
  summary?: string | null;
  channel?: string;
  priority?: number;
  threadParentId?: number | null;
  sourceTiming?: SourceTiming | null;
};
/** Use saved editorial relations only. A group is related reporting, not
 * proof of identical events or independent confirmation. Every member stays
 * accessible. Missing parents and cycles cannot consume unrelated rows. */
export function coverageGroups<T extends GroupStory>(
  stories: T[]
): Array<{ lead: T; related: T[] }> {
  const byId = new Map(stories.map((s) => [s.id, s]));
  const root = (story: T) => {
    const visited = new Set<number>();
    let current = story;
    while (current.threadParentId && byId.has(current.threadParentId)) {
      if (visited.has(current.id)) return story.id;
      visited.add(current.id);
      const parent = byId.get(current.threadParentId)!;
      if (parent.channel !== story.channel || parent.channel === "HOLD") return current.id;
      current = parent;
    }
    return current.threadParentId ?? current.id;
  };
  const groups = new Map<string, T[]>();
  for (const story of stories) {
    const key = `${story.channel ?? ""}:${root(story)}`;
    const group = groups.get(key) ?? [];
    group.push(story);
    groups.set(key, group);
  }
  return [...groups.values()]
    .flatMap((members) => {
      const ordered = members
        .slice()
        .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.id - b.id);
      // Additional explicit editor pins retain their own full story cards.
      const pins = ordered.slice(1).filter((s) => (s.priority ?? 0) >= 100);
      return [
        { lead: ordered[0]!, related: ordered.slice(1).filter((s) => !pins.includes(s)) },
        ...pins.map((lead) => ({ lead, related: [] as T[] })),
      ];
    })
    .sort((a, b) => (b.lead.priority ?? 0) - (a.lead.priority ?? 0) || a.lead.id - b.lead.id);
}

/** Diversify a single social selection. Related factual updates are eligible
 * again; no event-wide permanent publication lock is created. */
export function diverseCoverage<T extends GroupStory>(stories: T[]): T[] {
  const accepted = new Set<number>();
  for (const group of coverageGroups(stories)) {
    accepted.add(group.lead.id);
    for (const item of group.related) {
      const reporting = (s: T) => ({ ...s, title: `${s.title}\n${s.summary ?? ""}` });
      const update =
        /\b(?:withdr(?:aw|ew)\w*|revers\w*|cancel\w*|correct\w*|denie[sd]|reject\w*|approv\w*)\b/i;
      const a = reporting(item),
        b = reporting(group.lead);
      if (
        conflictingEvents(a, b) ||
        ((update.test(a.title) || update.test(b.title)) && a.title !== b.title)
      )
        accepted.add(item.id);
    }
  }
  return stories.filter((s) => accepted.has(s.id));
}
