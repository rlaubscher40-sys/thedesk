import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { preferenceStorage } from "@/lib/storage";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/useAuth";
const STORAGE_KEY = "thedesk:local-bookmarks";
function read(): Set<string> {
  try {
    const value = JSON.parse(preferenceStorage.getItem(STORAGE_KEY) ?? "[]");
    return new Set(
      Array.isArray(value) ? value.filter((id) => /^\d+$/.test(String(id))).map(String) : []
    );
  } catch {
    return new Set();
  }
}
type Bookmarks = {
  bookmarks: Set<string>;
  isBookmarked: (id: string) => boolean;
  toggle: (id: string) => void;
  count: number;
};
const Context = createContext<Bookmarks | null>(null);
/** One store per app: guest saves stay local; authenticated saves use the queue. */
export function BookmarkProvider({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const utils = trpc.useUtils();
  const queue = trpc.readingQueue.list.useQuery(user ? { accountId: user.id } : undefined, {
    enabled: !!user,
  });
  const add = trpc.readingQueue.add.useMutation();
  const remove = trpc.readingQueue.remove.useMutation();
  const [local, setLocal] = useState(read);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const busy = useRef(new Set<string>());
  const migrated = useRef<number | null>(null);
  const account = useRef(user?.id);
  const [syncing, setSyncing] = useState(false);
  const activeAccount = useRef(user?.id);
  activeAccount.current = user?.id;
  useEffect(() => {
    if (account.current !== user?.id) {
      account.current = user?.id;
      setPending({});
      migrated.current = null;
      busy.current.clear();
      setSyncing(false);
    }
  }, [user?.id, utils]);
  const saveLocal = useCallback((next: Set<string>) => {
    preferenceStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    setLocal(next);
  }, []);
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setLocal(read());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    if (!user || !queue.isSuccess || queue.isFetching || migrated.current === user.id) return;
    migrated.current = user.id;
    const ids = [...read()];
    if (!ids.length) return;
    const owner = user.id;
    setSyncing(true);
    void (async () => {
      let failed = false;
      for (const id of ids) {
        if (activeAccount.current !== owner) return;
        try {
          if (!queue.data.some((row) => String(row.feedItemId) === id))
            await add.mutateAsync({ feedItemId: Number(id) });
          if (activeAccount.current !== owner) return;
          const remaining = read();
          remaining.delete(id);
          saveLocal(remaining);
        } catch {
          failed = true;
        }
      }
      await utils.readingQueue.invalidate();
      if (activeAccount.current !== owner) return;
      setSyncing(false);
      if (failed)
        toast.error(
          "Some device saves could not sync. They are kept on this device. Reload to retry."
        );
    })();
  }, [user, queue.isSuccess, queue.isFetching, queue.data, add, saveLocal, utils]);
  const bookmarks = new Set(
    user
      ? (queue.data ?? []).filter((row) => row.feedItemId).map((row) => String(row.feedItemId))
      : local
  );
  for (const [id, saved] of Object.entries(pending)) {
    if (saved) bookmarks.add(id);
    else bookmarks.delete(id);
  }
  const toggle = (id: string) => {
    if (isLoading || syncing || (user && (!queue.isSuccess || queue.isFetching))) {
      toast.info("Your saved stories are loading. Please try again shortly.");
      return;
    }
    if (busy.current.has(id)) return;
    const saved = bookmarks.has(id);
    if (!user) {
      const next = new Set(local);
      if (saved) next.delete(id);
      else next.add(id);
      saveLocal(next);
      return;
    }
    const owner = user.id;
    busy.current.add(id);
    setPending((prev) => ({ ...prev, [id]: !saved }));
    void (async () => {
      try {
        if (saved) {
          for (const row of queue.data ?? [])
            if (String(row.feedItemId) === id) await remove.mutateAsync({ id: row.id });
        } else await add.mutateAsync({ feedItemId: Number(id) });
        await utils.readingQueue.invalidate();
      } catch {
        toast.error("Could not update Saved. Please try again.");
      } finally {
        if (activeAccount.current !== owner) return;
        busy.current.delete(id);
        setPending((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    })();
  };
  return createElement(
    Context.Provider,
    {
      value: { bookmarks, isBookmarked: (id) => bookmarks.has(id), toggle, count: bookmarks.size },
    },
    children
  );
}
export function useBookmarks() {
  const value = useContext(Context);
  if (!value) throw new Error("useBookmarks requires BookmarkProvider");
  return value;
}
