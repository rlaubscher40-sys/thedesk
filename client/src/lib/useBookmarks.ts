/**
 * localStorage-backed bookmarks. Stores a Set of story ids. Used by the
 * desk cards so the bookmark icon toggles instantly without needing a
 * server round-trip, the tRPC reading-queue mutation runs alongside
 * when the user is authenticated.
 */
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "thedesk:local-bookmarks";

function read(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

function write(set: Set<string>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => read());

  useEffect(() => {
    // Cross-tab sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setBookmarks(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isBookmarked = useCallback((id: string) => bookmarks.has(id), [bookmarks]);

  const toggle = useCallback((id: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      write(next);
      return next;
    });
  }, []);

  return { bookmarks, isBookmarked, toggle, count: bookmarks.size };
}
