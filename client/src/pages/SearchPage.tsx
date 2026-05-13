/**
 * Search across editions + feed items. Server returns both buckets; UI shows
 * them in their own tabs.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Search as SearchIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/Skeleton";
import { categoryAccentClass } from "@/lib/category";
import { cn } from "@/lib/cn";
import { trpc } from "@/lib/trpc";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount so / takes you straight to typing.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const search = trpc.search.all.useQuery(
    { query },
    { enabled: query.trim().length >= 2, staleTime: 30_000 }
  );

  return (
    <div>
      <PageHeader
        overline="The Desk · Search"
        title="Search the archive"
        kicker="Across every weekly edition and every daily feed item. Two characters minimum."
      />

      <div className="relative mb-6">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-fg-subtle)]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="cash rate, broker channel, AI, ..."
          className="w-full pl-10 pr-3 py-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded text-base focus:outline-none focus:border-amber-500/50"
        />
      </div>

      <SectionErrorBoundary section="Search results">
        {query.trim().length < 2 ? (
          <div className="text-sm text-[var(--color-fg-muted)]">Type at least two characters.</div>
        ) : search.isLoading ? (
          <ResultsSkeleton />
        ) : !search.data ? null : search.data.editions.length === 0 && search.data.feedItems.length === 0 ? (
          <div className="panel p-6 rounded text-sm text-[var(--color-fg-muted)]">
            No results for "{query}".
          </div>
        ) : (
          <div className="space-y-10">
            {search.data.editions.length > 0 && (
              <section>
                <p className="overline mb-3">
                  Editions ({search.data.editions.length})
                </p>
                <ul className="space-y-3">
                  {search.data.editions.map((ed) => (
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

            {search.data.feedItems.length > 0 && (
              <section>
                <p className="overline mb-3">
                  Feed items ({search.data.feedItems.length})
                </p>
                <ul className="space-y-3">
                  {search.data.feedItems.map((item) => (
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
                        <div className="flex gap-3 items-center mb-1">
                          <span className="overline" style={{ color: "var(--color-amber)" }}>
                            {item.category}
                          </span>
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
        )}
      </SectionErrorBoundary>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded" />
      ))}
    </div>
  );
}
