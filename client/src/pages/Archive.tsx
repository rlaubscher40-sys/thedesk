/**
 * The Archive, unified browse + search page.
 *
 * Empty query: browse-by-category mode. Categories render as a grid of
 * thread cards, each showing the most recent feed items in that category.
 * Clicking a chip filters the page to that category (drill-down view).
 *
 * Non-empty query: search results across editions and feed items, with the
 * same category chips above so the user can keep narrowing.
 *
 * Replaces both the old SearchPage and the old TopicThreads index, they
 * served related needs and one unified page reads cleaner.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Search as SearchIcon, X } from "lucide-react";
import type { DailyFeedItem } from "@shared/types";
import { PageHeader } from "@/components/PageHeader";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/Skeleton";
import { categoryAccentClass, categoryColour } from "@/lib/category";
import { cn } from "@/lib/cn";
import { useUserPrefs } from "@/lib/userPrefs";
import { trpc } from "@/lib/trpc";

function parseSearch(search: string): { q: string; cat: string | null } {
  const params = new URLSearchParams(search);
  return { q: params.get("q") ?? "", cat: params.get("cat") };
}

export default function ArchivePage() {
  // URL query state, /archive?q=foo and /archive?cat=PROPERTY both deep-link,
  // and the legacy /search redirect carries its query across via this.
  const search = useSearch();
  const [, navigate] = useLocation();
  const initial = parseSearch(search);
  const [query, setQuery] = useState(initial.q);
  const [category, setCategory] = useState<string | null>(initial.cat);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the search input on desktop so the user can start typing
  // immediately. On mobile we skip this, focusing pops the keyboard the
  // instant the page loads, which obscures the category chips and is
  // jarring when the user came here to browse, not search.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 768) return;
    inputRef.current?.focus();
  }, []);

  // Mirror state back into the URL so a refresh or share preserves the view.
  // Replace (don't push) so we don't fill the back stack with keystrokes.
  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category) params.set("cat", category);
    const next = params.toString();
    navigate(next ? `/archive?${next}` : "/archive", { replace: true });
  }, [query, category, navigate]);

  const recentByCategoryQuery = trpc.topics.recentByCategory.useQuery();
  const countsQuery = trpc.topics.itemCounts.useQuery();
  const searchQuery = trpc.search.all.useQuery(
    { query },
    { enabled: query.trim().length >= 2, staleTime: 30_000 }
  );
  const categoryQuery = trpc.topics.getByCategory.useQuery(
    { category: category ?? "" },
    { enabled: !!category }
  );

  // User's topic-allowlist preference. Applied to the overview's category
  // thread cards and to the search results, but NOT to the explicit
  // category drill-down, if the reader taps a chip the assumption is
  // they want to see that category regardless of their global filter.
  const { isCategoryAllowed } = useUserPrefs();

  const counts = new Map<string, number>(
    (countsQuery.data ?? [])
      .filter((r) => isCategoryAllowed(r.category))
      .map((r) => [r.category, r.total])
  );
  const recentByCategoryFiltered = useMemo(() => {
    const raw = recentByCategoryQuery.data ?? {};
    const out: Record<string, (typeof raw)[string]> = {};
    for (const [cat, items] of Object.entries(raw)) {
      if (isCategoryAllowed(cat)) out[cat] = items;
    }
    return out;
  }, [recentByCategoryQuery.data, isCategoryAllowed]);
  const filteredSearchResults = useMemo(() => {
    const raw = searchQuery.data;
    if (!raw) return undefined;
    return {
      editions: raw.editions,
      feedItems: raw.feedItems.filter((it) => isCategoryAllowed(it.category)),
    };
  }, [searchQuery.data, isCategoryAllowed]);
  const categories = Object.keys(recentByCategoryFiltered).sort(
    (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)
  );

  const isSearching = query.trim().length >= 2;
  const isCategoryView = !!category && !isSearching;
  const isOverview = !isSearching && !isCategoryView;

  return (
    <div>
      <PageHeader
        overline="The Desk · Archive"
        title="Search and browse"
        kicker="Every weekly edition, every daily item. Find by keyword or follow a thread."
        actions={
          <ArchiveMetaPanel
            totalStories={Array.from(counts.values()).reduce((a, b) => a + b, 0)}
            categoryCount={categories.length}
          />
        }
      />

      {/* Search input. */}
      <div className="relative mb-5">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-fg-subtle)]" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the archive…"
          className="w-full pl-11 pr-12 py-3.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded text-base focus:outline-none focus:border-[var(--color-amber)]/50 transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-white/5"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Category chip row, drives the drill-down filter. */}
      <SectionErrorBoundary section="Category chips">
        {categories.length > 0 && (
          <CategoryChips
            categories={categories}
            counts={counts}
            selected={category}
            onSelect={(c) => setCategory(c === category ? null : c)}
          />
        )}
      </SectionErrorBoundary>

      {/* Body switches based on query / category. */}
      <div className="mt-8">
        {isSearching && (
          <SectionErrorBoundary section="Search results">
            <SearchResults
              query={query}
              data={filteredSearchResults}
              loading={searchQuery.isLoading}
            />
          </SectionErrorBoundary>
        )}

        {isCategoryView && category && (
          <SectionErrorBoundary section="Category drill-down">
            <CategoryDrillDown
              category={category}
              data={categoryQuery.data}
              loading={categoryQuery.isLoading}
            />
          </SectionErrorBoundary>
        )}

        {isOverview && (
          <SectionErrorBoundary section="Topic threads overview">
            <TopicOverview
              recent={recentByCategoryFiltered}
              counts={counts}
              loading={recentByCategoryQuery.isLoading}
            />
          </SectionErrorBoundary>
        )}
      </div>
    </div>
  );
}

// ─── Category chips ─────────────────────────────────────────────────────────

function CategoryChips({
  categories,
  counts,
  selected,
  onSelect,
}: {
  categories: string[];
  counts: Map<string, number>;
  selected: string | null;
  onSelect: (c: string) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      <button
        onClick={() => onSelect(selected ?? "")}
        aria-pressed={selected === null}
        className={cn(
          "shrink-0 px-3 py-1.5 rounded transition-all border text-xs font-mono uppercase tracking-wider",
          selected === null
            ? "border-amber-400/60 bg-amber-500/10 text-amber-200"
            : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
        )}
      >
        All
      </button>
      {categories.map((c) => {
        const active = selected === c;
        return (
          <button
            key={c}
            onClick={() => onSelect(c)}
            aria-pressed={active}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded transition-all border text-xs font-mono uppercase tracking-wider flex items-center gap-2",
              active
                ? "bg-amber-500/10 text-amber-200"
                : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)]"
            )}
            style={
              active
                ? { borderColor: categoryColour(c), boxShadow: `0 0 14px ${categoryColour(c)}25` }
                : {}
            }
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: categoryColour(c) }} />
            <span>{c}</span>
            {counts.get(c) != null && (
              <span className="text-[var(--color-fg-subtle)] tabular-nums">
                {counts.get(c)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Overview (no query, no category) ───────────────────────────────────────

function TopicOverview({
  recent,
  counts,
  loading,
}: {
  recent: Record<string, DailyFeedItem[]> | undefined;
  counts: Map<string, number>;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded" />
        ))}
      </div>
    );
  }
  if (!recent || Object.keys(recent).length === 0) {
    return <p className="text-sm text-[var(--color-fg-muted)]">No threads yet.</p>;
  }
  const entries = Object.entries(recent).sort(
    ([a], [b]) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)
  );

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {entries.map(([category, items]) => (
        <CategoryThreadCard
          key={category}
          category={category}
          items={items}
          total={counts.get(category) ?? items.length}
        />
      ))}
    </div>
  );
}

function CategoryThreadCard({
  category,
  items,
  total,
}: {
  category: string;
  items: DailyFeedItem[];
  total: number;
}) {
  return (
    <Link
      href={`/topics/${category}`}
      className={cn(
        "block panel panel-hover rounded p-5 h-full",
        categoryAccentClass(category)
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="overline-amber" style={{ color: categoryColour(category) }}>
          {category}
        </p>
        <span className="font-mono text-xs tabular-nums text-[var(--color-fg-subtle)]">
          {total}
        </span>
      </div>
      <ul className="space-y-3">
        {items.slice(0, 3).map((item, idx) => (
          <li key={item.id || `item-${idx}`} className="text-sm leading-snug">
            <span className="font-serif line-clamp-2 text-[var(--color-fg-muted)]">
              {item.title}
            </span>
          </li>
        ))}
      </ul>
    </Link>
  );
}

// ─── Category drill-down (category chip selected, no query) ─────────────────

function CategoryDrillDown({
  category,
  data,
  loading,
}: {
  category: string;
  data:
    | {
        feedItems: DailyFeedItem[];
        editions: Array<{ id: number; editionNumber: number; weekRange: string }>;
      }
    | undefined;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-64 w-full rounded" />;
  if (!data) return null;

  return (
    <div className="space-y-10">
      {data.feedItems.length === 0 && data.editions.length === 0 && (
        <div className="panel p-6 rounded text-sm text-[var(--color-fg-muted)]">
          Nothing tagged {category} yet.
        </div>
      )}

      {data.feedItems.length > 0 && (
        <section>
          <p className="overline mb-3">Daily feed ({data.feedItems.length})</p>
          <ul className="space-y-3">
            {data.feedItems.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "panel panel-hover rounded p-4",
                  categoryAccentClass(item.category)
                )}
              >
                <Link
                  href={`/story/${item.id}`}
                  className="block hover:text-amber-300 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="overline">{item.source}</span>
                    <span className="overline">·</span>
                    <span className="overline">{item.feedDate}</span>
                  </div>
                  <p className="font-serif text-base leading-snug">{item.title}</p>
                  <p className="text-sm text-[var(--color-fg-muted)] mt-1 line-clamp-2">
                    {item.summary}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.editions.length > 0 && (
        <section>
          <p className="overline mb-3">Editions ({data.editions.length})</p>
          <ul className="space-y-3">
            {data.editions.map((ed) => (
              <li key={ed.id} className="panel panel-hover rounded p-4">
                <Link
                  href={`/editions/${ed.editionNumber}`}
                  className="block hover:text-amber-300 transition-colors"
                >
                  <p className="overline mb-1">Edition {ed.editionNumber}</p>
                  <p className="font-serif text-base leading-snug">{ed.weekRange}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ─── Search results (query active) ──────────────────────────────────────────

function SearchResults({
  query,
  data,
  loading,
}: {
  query: string;
  data:
    | {
        editions: Array<{ id: number; editionNumber: number; weekRange: string }>;
        feedItems: DailyFeedItem[];
      }
    | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded" />
        ))}
      </div>
    );
  }
  if (!data) return null;
  if (data.editions.length === 0 && data.feedItems.length === 0) {
    return (
      <div className="panel p-6 rounded text-sm text-[var(--color-fg-muted)]">
        No results for "{query}".
      </div>
    );
  }
  return (
    <div className="space-y-10">
      {data.editions.length > 0 && (
        <section>
          <p className="overline mb-3">Editions ({data.editions.length})</p>
          <ul className="space-y-3">
            {data.editions.map((ed) => (
              <li key={ed.id} className="panel panel-hover rounded p-4">
                <Link
                  href={`/editions/${ed.editionNumber}`}
                  className="block hover:text-amber-300 transition-colors"
                >
                  <p className="overline mb-1">Edition {ed.editionNumber}</p>
                  <p className="font-serif text-base leading-snug">{ed.weekRange}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.feedItems.length > 0 && (
        <section>
          <p className="overline mb-3">Feed items ({data.feedItems.length})</p>
          <ul className="space-y-3">
            {data.feedItems.map((item) => (
              <li
                key={item.id}
                className={cn("panel panel-hover rounded p-4", categoryAccentClass(item.category))}
              >
                <Link
                  href={`/story/${item.id}`}
                  className="block hover:text-amber-300 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="overline-amber" style={{ color: categoryColour(item.category) }}>
                      {item.category}
                    </span>
                    <span className="overline">·</span>
                    <span className="overline">{item.source}</span>
                  </div>
                  <p className="font-serif text-base leading-snug">{item.title}</p>
                  <p className="text-sm text-[var(--color-fg-muted)] mt-1 line-clamp-2">
                    {item.summary}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * Editorial meta panel for the Archive header. Earns the right-side
 * whitespace with two corpus stats: total stories indexed across
 * every category, and how many categories are active for the current
 * user (after their topic-allowlist preference).
 */
function ArchiveMetaPanel({
  totalStories,
  categoryCount,
}: {
  totalStories: number;
  categoryCount: number;
}) {
  if (!totalStories && !categoryCount) return null;
  return (
    <div
      className="hidden md:block panel rounded-sm px-5 py-4 space-y-3.5 text-right shrink-0"
      style={{ minWidth: 200 }}
    >
      {totalStories > 0 && (
        <ArchiveMetaRow
          label="Stories archived"
          value={totalStories.toLocaleString("en-AU")}
        />
      )}
      {categoryCount > 0 && (
        <ArchiveMetaRow
          label="Categories indexed"
          value={String(categoryCount).padStart(2, "0")}
        />
      )}
    </div>
  );
}

function ArchiveMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p
        className="font-mono uppercase text-[var(--color-fg-subtle)]"
        style={{ fontSize: "10px", letterSpacing: "0.22em" }}
      >
        {label}
      </p>
      <p
        className="font-mono text-[var(--color-fg)] tabular-nums"
        style={{ fontSize: "12px", letterSpacing: "0.04em" }}
      >
        {value}
      </p>
    </div>
  );
}
