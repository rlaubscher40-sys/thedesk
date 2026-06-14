/**
 * Cmd+K / Ctrl+K command palette. Quick navigation + search across the
 * archive. Keyboard-first: arrow keys move, enter selects, esc closes.
 *
 * Three sections:
 *   · Navigation (pages)
 *   · Editions (top 5)
 *   · Recent feed items matching the query
 *
 * Lives outside the page tree so it works from anywhere.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bookmark,
  Info,
  Newspaper,
  Search,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { trpc } from "@/lib/trpc";

type Item = {
  id: string;
  label: string;
  hint?: string;
  icon?: typeof Newspaper;
  group: "nav" | "edition" | "feed";
  href: string;
};

const NAV_ITEMS: Item[] = [
  { id: "nav-today", label: "Today", hint: "Daily scan", icon: Newspaper, group: "nav", href: "/" },
  { id: "nav-editions", label: "Editions", hint: "Weekly deep-dives", icon: BookOpen, group: "nav", href: "/editions" },
  { id: "nav-trends", label: "Trends", hint: "Intelligence dashboard", icon: BarChart3, group: "nav", href: "/trends" },
  { id: "nav-queue", label: "Reading Queue", hint: "Saved items", icon: Bookmark, group: "nav", href: "/queue" },
  { id: "nav-archive", label: "Archive", hint: "Search + browse", icon: Search, group: "nav", href: "/archive" },
  { id: "nav-about", label: "About", hint: "What this is", icon: Info, group: "nav", href: "/about" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  // Global hotkey.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Open on demand from a tap (mobile has no ⌘K) — the mobile header's
  // search button dispatches this event so the same palette is the single
  // search surface on every device.
  useEffect(() => {
    const open = () => setOpen(true);
    window.addEventListener("thedesk:open-search", open);
    return () => window.removeEventListener("thedesk:open-search", open);
  }, []);

  // Focus input on open, reset on close.
  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      // Defer so the input exists.
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  // Lazy: only run live search when the palette is open + query is meaningful.
  const editionsQuery = trpc.editions.list.useQuery(undefined, { enabled: open });
  const searchQuery = trpc.search.all.useQuery(
    { query },
    { enabled: open && query.trim().length >= 2, staleTime: 30_000 }
  );

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const matchesQuery = (label: string) => q === "" || label.toLowerCase().includes(q);

    const nav = NAV_ITEMS.filter((i) => matchesQuery(i.label));
    const editions: Item[] = (editionsQuery.data ?? [])
      .slice(0, 8)
      .map(
        (ed): Item => ({
          id: `edition-${ed.id}`,
          label: `Edition ${ed.editionNumber}`,
          hint: ed.weekRange,
          icon: BookOpen,
          group: "edition",
          href: `/editions/${ed.editionNumber}`,
        })
      )
      .filter((i) => matchesQuery(`${i.label} ${i.hint ?? ""}`));

    const feed: Item[] =
      q.length >= 2
        ? (searchQuery.data?.feedItems ?? []).slice(0, 6).map(
            (f): Item => ({
              id: `feed-${f.id}`,
              label: f.title,
              hint: `${f.category} · ${f.source}`,
              icon: Newspaper,
              group: "feed",
              href: `/story/${f.id}`,
            })
          )
        : [];

    return [...nav, ...editions, ...feed];
  }, [query, editionsQuery.data, searchQuery.data]);

  // Keep the highlight in range whenever the items list shrinks.
  useEffect(() => {
    if (highlight >= items.length) setHighlight(Math.max(0, items.length - 1));
  }, [items.length, highlight]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(items.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sel = items[highlight];
      if (sel) {
        navigate(sel.href);
        setOpen(false);
      }
    }
  }

  if (!open) return null;

  // Group items by section for the rendered list while keeping a flat
  // index for keyboard navigation.
  const sections: Array<{ label: string; items: Item[] }> = [];
  const groupTitles: Record<Item["group"], string> = {
    nav: "Pages",
    edition: "Editions",
    feed: "Stories",
  };
  for (const it of items) {
    let bucket = sections.find((s) => s.label === groupTitles[it.group]);
    if (!bucket) {
      bucket = { label: groupTitles[it.group], items: [] };
      sections.push(bucket);
    }
    bucket.items.push(it);
  }

  // Build a map from item.id → flat index so we can highlight correctly.
  const flatIndex = new Map(items.map((it, i) => [it.id, i]));

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-2xl panel rounded shadow-2xl animate-fade-in flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
          <Search className="h-4 w-4 text-[var(--color-fg-subtle)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Jump to a page, edition or story…"
            className="flex-1 bg-transparent text-base focus:outline-none placeholder:text-[var(--color-fg-subtle)]"
          />
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] border border-[var(--color-border)] text-[var(--color-fg-subtle)]">
            ESC
          </kbd>
        </div>

        <div className="overflow-y-auto flex-1 py-2">
          {items.length === 0 && (
            <p className="px-4 py-6 text-sm text-[var(--color-fg-muted)]">
              No matches. Try a different word.
            </p>
          )}
          {sections.map((section) => (
            <div key={section.label}>
              <p className="overline px-4 py-2 mt-1 text-[var(--color-fg-subtle)]">
                {section.label}
              </p>
              {section.items.map((it) => {
                const idx = flatIndex.get(it.id)!;
                const active = idx === highlight;
                const Icon = it.icon ?? ArrowRight;
                return (
                  <button
                    key={it.id}
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => {
                      navigate(it.href);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors",
                      active
                        ? "bg-amber-500/10 text-[var(--color-fg)]"
                        : "text-[var(--color-fg-muted)] hover:bg-white/[0.04]"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active ? "text-amber-300" : "text-[var(--color-fg-subtle)]"
                      )}
                    />
                    <span className="flex-1 min-w-0 truncate text-sm">{it.label}</span>
                    {it.hint && (
                      <span className="overline shrink-0 text-[var(--color-fg-subtle)] truncate max-w-[40%]">
                        {it.hint}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 border-t border-[var(--color-border)] text-[10px] font-mono uppercase tracking-wider text-[var(--color-fg-subtle)]">
          <Hint k="↑↓" label="navigate" />
          <Hint k="↵" label="open" />
          <Hint k="ESC" label="close" />
          <span className="ml-auto">⌘K from anywhere</span>
        </div>
      </div>
    </div>
  );
}

function Hint({ k, label }: { k: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <kbd className="px-1.5 py-0.5 rounded bg-white/[0.05] border border-[var(--color-border)]">
        {k}
      </kbd>
      {label}
    </span>
  );
}
