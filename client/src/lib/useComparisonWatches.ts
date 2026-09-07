import { useMemo, useSyncExternalStore } from "react";
import {
  COMPARISON_WATCH_KEY,
  parseComparisonWatches,
  readComparisonWatchValue,
  removeComparisonWatch,
  writeComparisonWatch,
  type ComparisonWatch,
} from "./comparisonWatches";

const WATCH_EVENT = "thedesk:comparison-watches-changed";
function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
function snapshot(): string {
  return readComparisonWatchValue(storage());
}
function serverSnapshot(): string {
  return "";
}
function subscribe(notify: () => void): () => void {
  const changed = (event: StorageEvent) => {
    if (event.key === COMPARISON_WATCH_KEY || event.key === null) notify();
  };
  window.addEventListener("storage", changed);
  window.addEventListener(WATCH_EVENT, notify);
  return () => {
    window.removeEventListener("storage", changed);
    window.removeEventListener(WATCH_EVENT, notify);
  };
}
function announce() {
  window.dispatchEvent(new Event(WATCH_EVENT));
}

export function useComparisonWatches() {
  const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const watches = useMemo(() => parseComparisonWatches(raw), [raw]);
  return {
    watches,
    save: (watch: ComparisonWatch, replaceBaseline = false) => {
      const result = writeComparisonWatch(storage(), watch, replaceBaseline);
      if (result.ok) announce();
      return result;
    },
    remove: (key: string) => {
      const ok = removeComparisonWatch(storage(), key);
      if (ok) announce();
      return ok;
    },
  };
}
