/**
 * The Archive — search and browse as an index, not a card wall.
 *
 * Title block with corpus stats in hairline-divided cells, then a
 * typographic search field (a 3px rule above, a hairline below, the query
 * set in Playfair with an accent caret — no bordered box), the category
 * index row, and a `1fr / 1px / 340px` results grid.
 *
 * Behaviour is unchanged: the same `?q=` / `?cat=` URL state, the same
 * tRPC queries, the same topic-allowlist filtering, and `highlight()`
 * still marks matched terms. The Today page's category sub-filter now
 * lives in the category index row here, which is where browsing by topic
 * belongs.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Search as SearchIcon } from "lucide-react";
import type { DailyFeedItem } from "@shared/types";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/Skeleton";
import { GUTTER_X } from "@/components/broadsheet/tokens";
import { useCategoryColour } from "@/lib/category";
import { cn } from "@/lib/cn";
import { highlight } from "@/lib/highlight";
import { useUserPrefs } from "@/lib/userPrefs";
import { trpc } from "@/lib/trpc";

/** One-line description per beat for the "Or follow a beat" rail. */
const BEAT_BLURB: Record<string, string> = {
  MACRO: "The rate cycle and the signals that move it.",
  PROPERTY: "Clearance, listings and the capacity constraint at the mid-tier.",
  POLICY: "APRA, Treasury and everything that changes a client's borrowing power.",
  MARKETS: "Lender pricing, SMSF lending and the non-bank channel.",
  ECONOMICS: "Inflation, wages and the labour market.",
  TECH: "The tooling reshaping origination and advice.",
  AI: "Where models are actually being put to work.",
  GEOPOLITICS: "Offshore events with a domestic transmission line.",
  SCIENCE: "Research with a read-through to the built environment.",
  OTHER: "Everything that doesn't sit on a named beat.",
};

function parseSearch(search: string): { q: string; cat: string | null } {
  const params = new URLSearchParams(search);
  return { q: params.get("q") ?? "", cat: params.get("cat") };
}

export default function ArchivePage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const initial = parseSearch(search);
  const [query, setQuery] = useState(initial.q);
  const [category, setCategory] = useState<string | null>(initial.cat);
  const inputRef = useRef<HTMLInputElement>(null);
  const colourFor = useCategoryColour();

  // Auto-focus on desktop so the reader can start typing immediately. On
  // mobile that pops the keyboard the instant the page loads and hides the
  // category row, which is jarring for someone who came here to browse.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 768) return;
    inputRef.current?.focus();
  }, []);

  // Mirror state back into the URL so a refresh or share preserves the view.
  // Replace (don't push) so keystrokes don't fill the back stack.
  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category) params.set("cat", category);
    const next = params.toString();
    navigate(next ? `/archive?${next}` : "/archive", { replace: true });
  }, [query, category, navigate]);

  const recentByCategoryQuery = trpc.topics.recentByCategory.useQuery();
  const countsQuery = trpc.topics.itemCounts.useQuery();
  const editionsQuery = trpc.editions.list.useQuery();
  const searchQuery = trpc.search.all.useQuery(
    { query },
    { enabled: query.trim().length >= 2, staleTime: 30_000 }
  );
  const categoryQuery = trpc.topics.getByCategory.useQuery(
    { category: category ?? "" },
    { enabled: !!category }
  );

  // User's topic-allowlist preference. Applied to the browse view and to
  // search results, but NOT to an explicit category drill-down: if the
  // reader picked a beat, they want that beat regardless of the filter.
  const { isCategoryAllowed } = useUserPrefs();

  const counts = useMemo(
    () =>
      new Map<string, number>(
        (countsQuery.data ?? [])
          .filter((r) => isCategoryAllowed(r.category))
          .map((r) => [r.category, r.total])
      ),
    [countsQuery.data, isCategoryAllowed]
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
  const totalStories = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  const editions = editionsQuery.data ?? [];

  const isSearching = query.trim().length >= 2;
  const isCategoryView = !!category && !isSearching;

  const resultCount = filteredSearchResults
    ? filteredSearchResults.editions.length + filteredSearchResults.feedItems.length
    : 0;

  return (
    <div className={cn(GUTTER_X, "pt-9")}>
      {/* Title block + corpus stats */}
      <div className="flex items-end justify-between gap-10 flex-wrap">
        <div className="min-w-0">
          <p className="bs-label-accent" style={{ letterSpacing: "0.24em" }}>
            The Desk · Archive
          </p>
          <h1
            className="font-serif font-bold mt-3.5"
            style={{
              fontSize: "clamp(36px, 4.6vw, 64px)",
              lineHeight: 0.94,
              letterSpacing: "-0.03em",
            }}
          >
            Search and browse
          </h1>
          <p
            className="font-serif mt-3.5 max-w-[52ch]"
            style={{ fontSize: 21, lineHeight: 1.42, color: "var(--color-fg-muted)" }}
          >
            Every weekly edition and every daily item. Find it by keyword, or follow one
            beat back through the year.
          </p>
        </div>

        <div className="shrink-0 flex rule-hair-l">
          <CorpusStat label="Stories archived" value={totalStories.toLocaleString("en-AU")} />
          {editions.length > 0 && (
            <div className="rule-hair-l">
              <CorpusStat label="Editions" value={String(editions.length)} />
            </div>
          )}
        </div>
      </div>

      {/* Typographic search field. */}
      <div className="rule-major rule-hair-b mt-7">
        <label className="flex items-center gap-4 py-4" htmlFor="archive-search">
          <SearchIcon
            className="h-[22px] w-[22px] shrink-0 text-[var(--color-fg-muted)]"
            strokeWidth={1.7}
            aria-hidden="true"
          />
          <span className="sr-only">Search the archive</span>
          <input
            id="archive-search"
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the archive…"
            className="flex-1 min-w-0 bg-transparent border-0 outline-none font-serif"
            style={{
              fontSize: "clamp(22px, 3vw, 34px)",
              color: "var(--color-fg)",
              caretColor: "var(--color-accent-text)",
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="bs-label bs-link shrink-0"
              style={{ letterSpacing: "0.18em" }}
            >
              {isSearching ? `${resultCount} result${resultCount === 1 ? "" : "s"} · ` : ""}
              clear ✕
            </button>
          )}
        </label>
      </div>

      {/* Category index row. Hairline-divided buttons, each a dot + name +
          tabular count; the active one carries the accent underline. */}
      {categories.length > 0 && (
        <SectionErrorBoundary section="Category index">
          <div className="rule-hair-b flex flex-wrap overflow-x-auto no-scrollbar">
            <IndexButton
              label="All"
              count={totalStories}
              active={category === null}
              onClick={() => setCategory(null)}
              first
            />
            {categories.map((c) => (
              <IndexButton
                key={c}
                label={c}
                count={counts.get(c)}
                dot={colourFor(c)}
                active={category === c}
                onClick={() => setCategory(category === c ? null : c)}
              />
            ))}
          </div>
        </SectionErrorBoundary>
      )}

      {/* Results + rail */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_1px_340px]">
        <div className="pt-8 lg:pr-13 min-w-0">
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
              <CategoryResults
                category={category}
                data={categoryQuery.data}
                loading={categoryQuery.isLoading}
              />
            </SectionErrorBoundary>
          )}

          {!isSearching && !isCategoryView && (
            <SectionErrorBoundary section="Recent by beat">
              <RecentByBeat
                recent={recentByCategoryFiltered}
                counts={counts}
                loading={recentByCategoryQuery.isLoading}
              />
            </SectionErrorBoundary>
          )}
        </div>

        <div
          className="hidden lg:block"
          style={{ background: "var(--color-border)" }}
          aria-hidden="true"
        />

        <aside className="pt-8 lg:pl-10 min-w-0">
          {categories.length > 0 && (
            <>
              <p className="bs-label" style={{ letterSpacing: "0.24em" }}>
                Or follow a beat
              </p>
              <div className="mt-4">
                {categories.slice(0, 4).map((c, i) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setCategory(c);
                    }}
                    className={cn(
                      "bs-row rule-hair block w-full text-left py-3.5",
                      i === Math.min(categories.length, 4) - 1 && "rule-hair-b"
                    )}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span
                        className="font-mono uppercase"
                        style={{ fontSize: 10, letterSpacing: "0.18em", color: colourFor(c) }}
                      >
                        {c}
                      </span>
                      <span
                        className="font-mono tabular-nums text-[var(--color-fg-subtle)]"
                        style={{ fontSize: 11 }}
                      >
                        {counts.get(c) ?? 0}
                      </span>
                    </span>
                    <span
                      className="block mt-1.5 text-[var(--color-fg-muted)]"
                      style={{ fontSize: 14.5, lineHeight: 1.45 }}
                    >
                      {BEAT_BLURB[c] ?? BEAT_BLURB.OTHER}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {editions.length > 0 && (
            <>
              <p className="bs-label mt-8 mb-3.5" style={{ letterSpacing: "0.24em" }}>
                By edition
              </p>
              <div className="flex flex-wrap gap-1.5">
                {editions.slice(0, 7).map((ed) => (
                  <Link
                    key={ed.editionNumber}
                    href={`/editions/${ed.editionNumber}`}
                    className="bs-link font-mono tabular-nums px-3 py-2 rounded-sm"
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.1em",
                      border: "1px solid var(--color-border-strong)",
                    }}
                  >
                    {String(ed.editionNumber).padStart(2, "0")}
                  </Link>
                ))}
                <Link
                  href="/editions"
                  className="bs-link font-mono px-3 py-2 rounded-sm text-[var(--color-fg-subtle)]"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.1em",
                    border: "1px solid var(--color-border-strong)",
                  }}
                >
                  All {editions.length}
                </Link>
              </div>
            </>
          )}

          <div
            className="mt-8 p-5"
            style={{
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-elevated)",
            }}
          >
            <p className="bs-label">Shortcuts</p>
            <div className="flex flex-col gap-2.5 mt-3">
              <Shortcut keys="/" label="Jump to search" />
              <Shortcut keys="⌘K" label="Command palette" />
              <Shortcut keys="J K" label="Move through results" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CorpusStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-6 text-right">
      <p className="bs-label" style={{ letterSpacing: "0.2em" }}>
        {label}
      </p>
      <p
        className="font-serif font-bold tabular-nums mt-2"
        style={{ fontSize: 40, lineHeight: 1 }}
      >
        {value}
      </p>
    </div>
  );
}

function IndexButton({
  label,
  count,
  dot,
  active,
  onClick,
  first = false,
}: {
  label: string;
  count?: number;
  dot?: string;
  active: boolean;
  onClick: () => void;
  first?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "bs-link inline-flex items-baseline gap-2 whitespace-nowrap py-3.5",
        first ? "pr-4" : "rule-hair-l px-4"
      )}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: active ? "var(--color-fg)" : "var(--color-fg-muted)",
      }}
    >
      {dot && (
        <span
          className="inline-block h-[5px] w-[5px] rounded-full"
          style={{ background: dot }}
          aria-hidden="true"
        />
      )}
      <span
        style={{
          borderBottom: active ? "2px solid var(--color-accent-text)" : "2px solid transparent",
          paddingBottom: 3,
        }}
      >
        {label}
      </span>
      {count != null && (
        <span className="tabular-nums text-[var(--color-fg-subtle)]">{count}</span>
      )}
    </button>
  );
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <p className="flex items-center gap-2.5" style={{ fontSize: 13.5, color: "var(--color-fg-muted)" }}>
      <kbd
        className="font-mono rounded-sm px-1.5 py-0.5"
        style={{ fontSize: 10, border: "1px solid var(--color-border-strong)" }}
      >
        {keys}
      </kbd>
      {label}
    </p>
  );
}

/** A result row: a 96px meta column beside headline + snippet. */
function ResultRow({
  href,
  meta,
  metaSub,
  title,
  snippet,
  first = false,
  last = false,
}: {
  href: string;
  meta: React.ReactNode;
  metaSub?: string;
  title: React.ReactNode;
  snippet?: React.ReactNode;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "bs-row rule-hair grid grid-cols-[96px_minmax(0,1fr)] gap-5 py-4 items-baseline",
        first && "rule-band",
        last && "rule-hair-b"
      )}
    >
      <div>
        <div
          className="font-mono uppercase"
          style={{ fontSize: 10, letterSpacing: "0.16em" }}
        >
          {meta}
        </div>
        {metaSub && (
          <p className="font-mono mt-1.5 text-[var(--color-fg-subtle)]" style={{ fontSize: 10 }}>
            {metaSub}
          </p>
        )}
      </div>
      <div className="min-w-0">
        <p
          className="font-serif"
          style={{ fontSize: 21, lineHeight: 1.28, letterSpacing: "-0.02em" }}
        >
          {title}
        </p>
        {snippet && (
          <p
            className="mt-1.5 text-[var(--color-fg-muted)]"
            style={{ fontSize: 15, lineHeight: 1.55 }}
          >
            {snippet}
          </p>
        )}
      </div>
    </Link>
  );
}

function ResultGroup({ label, count }: { label: string; count: number }) {
  return (
    <p className="bs-label mb-1.5" style={{ letterSpacing: "0.24em" }}>
      {label} · {count} match{count === 1 ? "" : "es"}
    </p>
  );
}

function RowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-none" />
      ))}
    </div>
  );
}

function SearchResults({
  query,
  data,
  loading,
}: {
  query: string;
  data:
    | {
        editions: Array<{
          id: number;
          editionNumber: number;
          weekRange: string;
          snippet?: string | null;
        }>;
        feedItems: Array<DailyFeedItem & { snippet?: string | null }>;
      }
    | undefined;
  loading: boolean;
}) {
  const colourFor = useCategoryColour();
  if (loading) return <RowsSkeleton />;
  if (!data) return null;
  if (data.editions.length === 0 && data.feedItems.length === 0) {
    return (
      <p className="py-10 text-[var(--color-fg-muted)]">No results for &ldquo;{query}&rdquo;.</p>
    );
  }

  return (
    <div className="space-y-9">
      {data.editions.length > 0 && (
        <section>
          <ResultGroup label="Editions" count={data.editions.length} />
          {data.editions.map((ed, i) => (
            <ResultRow
              key={ed.id}
              href={`/editions/${ed.editionNumber}`}
              first={i === 0}
              last={i === data.editions.length - 1}
              meta={
                <span style={{ color: "var(--color-accent-text)" }}>
                  Ed. {String(ed.editionNumber).padStart(2, "0")}
                </span>
              }
              title={highlight(ed.weekRange, query)}
              snippet={ed.snippet ? highlight(ed.snippet, query) : undefined}
            />
          ))}
        </section>
      )}

      {data.feedItems.length > 0 && (
        <section>
          <ResultGroup label="Daily items" count={data.feedItems.length} />
          {data.feedItems.map((item, i) => (
            <ResultRow
              key={item.id}
              href={`/story/${item.id}`}
              first={i === 0}
              last={i === data.feedItems.length - 1}
              meta={<span style={{ color: colourFor(item.category) }}>{item.category}</span>}
              metaSub={item.feedDate}
              title={highlight(item.title, query)}
              snippet={
                <>
                  {highlight(item.snippet || item.summary, query)}{" "}
                  {item.source && (
                    <span
                      className="font-mono uppercase text-[var(--color-fg-subtle)]"
                      style={{ fontSize: 10, letterSpacing: "0.14em" }}
                    >
                      {item.source}
                    </span>
                  )}
                </>
              }
            />
          ))}
        </section>
      )}
    </div>
  );
}

function CategoryResults({
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
  const colourFor = useCategoryColour();
  if (loading) return <RowsSkeleton />;
  if (!data) return null;
  if (data.feedItems.length === 0 && data.editions.length === 0) {
    return <p className="py-10 text-[var(--color-fg-muted)]">Nothing tagged {category} yet.</p>;
  }

  return (
    <div className="space-y-9">
      {data.editions.length > 0 && (
        <section>
          <ResultGroup label="Editions" count={data.editions.length} />
          {data.editions.map((ed, i) => (
            <ResultRow
              key={ed.id}
              href={`/editions/${ed.editionNumber}`}
              first={i === 0}
              last={i === data.editions.length - 1}
              meta={
                <span style={{ color: "var(--color-accent-text)" }}>
                  Ed. {String(ed.editionNumber).padStart(2, "0")}
                </span>
              }
              title={ed.weekRange}
            />
          ))}
        </section>
      )}

      {data.feedItems.length > 0 && (
        <section>
          <ResultGroup label="Daily items" count={data.feedItems.length} />
          {data.feedItems.map((item, i) => (
            <ResultRow
              key={item.id}
              href={`/story/${item.id}`}
              first={i === 0}
              last={i === data.feedItems.length - 1}
              meta={<span style={{ color: colourFor(item.category) }}>{item.category}</span>}
              metaSub={item.feedDate}
              title={item.title}
              snippet={item.summary}
            />
          ))}
        </section>
      )}
    </div>
  );
}

/** Browse view: the most recent items on each beat, as an index. */
function RecentByBeat({
  recent,
  counts,
  loading,
}: {
  recent: Record<string, DailyFeedItem[]> | undefined;
  counts: Map<string, number>;
  loading: boolean;
}) {
  const colourFor = useCategoryColour();
  if (loading) return <RowsSkeleton rows={6} />;
  if (!recent || Object.keys(recent).length === 0) {
    return <p className="py-10 text-[var(--color-fg-muted)]">No stories archived yet.</p>;
  }

  const entries = Object.entries(recent).sort(
    ([a], [b]) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0)
  );

  return (
    <div className="space-y-9">
      {entries.map(([category, items]) => (
        <section key={category}>
          <ResultGroup label={category} count={counts.get(category) ?? items.length} />
          {items.slice(0, 3).map((item, i) => (
            <ResultRow
              key={item.id || `${category}-${i}`}
              href={`/story/${item.id}`}
              first={i === 0}
              last={i === Math.min(items.length, 3) - 1}
              meta={<span style={{ color: colourFor(category) }}>{category}</span>}
              metaSub={item.feedDate}
              title={item.title}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
