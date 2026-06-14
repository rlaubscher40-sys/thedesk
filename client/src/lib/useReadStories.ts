/**
 * localStorage-backed "have I opened this story yet" set, keyed by story id.
 * Powers the unread dot on the Today brief so a returning reader can see at a
 * glance what they haven't looked at. A story is marked read when its
 * /story/:id page is opened (see StoryPage). Best-effort and local-only — no
 * server round-trip, no auth needed.
 */
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "thedesk:read-stories";
// Cap the stored set so it can't grow without bound; oldest ids fall off.
const MAX_TRACKED = 400;

function read(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function write(set: Set<string>) {
  // Keep the most-recent MAX_TRACKED (insertion order is preserved by Set).
  const arr = [...set].slice(-MAX_TRACKED);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

/** Imperative marker — safe to call from a page effect without subscribing. */
export function markStoryRead(id: number | string): void {
  if (typeof window === "undefined") return;
  const set = read();
  if (set.has(String(id))) return;
  set.add(String(id));
  write(set);
  // Let same-tab subscribers (the brief) refresh — the native 'storage' event
  // only fires across tabs, so dispatch our own for this one.
  window.dispatchEvent(new Event("thedesk:read-stories-changed"));
}

export function useReadStories() {
  const [readSet, setReadSet] = useState<Set<string>>(() => read());

  useEffect(() => {
    const refresh = () => setReadSet(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("thedesk:read-stories-changed", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("thedesk:read-stories-changed", refresh);
    };
  }, []);

  const isRead = useCallback((id: number | string) => readSet.has(String(id)), [readSet]);
  return { isRead };
}
