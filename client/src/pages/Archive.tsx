/**
 * Archive page — paginated browse of every feed item ever ingested.
 * Category filter at top. Load-more pagination at the bottom.
 */
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { FeedItemCard } from "@/components/feed/FeedItemCard";
import { Footer } from "@/components/desk/Footer";
import { PageHeader } from "@/components/PageHeader";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { trpc } from "@/lib/trpc";

const PAGE_SIZE = 30;

export default function Archive() {
  useDocumentTitle("Archive");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(0);

  const query = trpc.feed.archive.useQuery(
    { category, limit: PAGE_SIZE, offset: page * PAGE_SIZE },
    { staleTime: 60_000 }
  );

  const items = query.data ?? [];
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) set.add(it.category.toUpperCase());
    return Array.from(set).sort();
  }, [items]);

  function setFilter(c: string | undefined) {
    setCategory(c);
    setPage(0);
  }

  return (
    <div className="space-y-10">
      <PageHeader
        overline="The Desk · Archive"
        title="Archive"
        kicker="Every story we've covered, in reverse chronological order. Filter by category to narrow the read."
      />

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        <Chip active={!category} label="All" onClick={() => setFilter(undefined)} />
        {availableCategories.map((c) => (
          <Chip
            key={c}
            active={category === c}
            label={c}
            onClick={() => setFilter(c)}
          />
        ))}
      </div>

      <SectionErrorBoundary section="Archive list">
        {query.isLoading ? (
          <div className="flex items-center justify-center py-20 text-[var(--color-fg-subtle)]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="panel p-12 rounded-sm text-center text-sm text-[var(--color-fg-muted)]">
            Nothing in the archive yet. Daily ingest runs at 6am Sydney.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {items.map((item) => (
                <FeedItemCard key={item.id} item={item} />
              ))}
            </div>
            <div className="flex items-center justify-center gap-3 mt-10">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || query.isFetching}
                className="px-4 py-2 rounded-sm text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-fg-muted)] disabled:opacity-30 hover:text-amber-300 transition-colors"
                style={{ boxShadow: "inset 0 0 0 1px var(--color-border)" }}
              >
                ← Newer
              </button>
              <span className="overline text-[var(--color-fg-subtle)] tabular-nums">
                Page {page + 1}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={items.length < PAGE_SIZE || query.isFetching}
                className="px-4 py-2 rounded-sm text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-fg-muted)] disabled:opacity-30 hover:text-amber-300 transition-colors"
                style={{ boxShadow: "inset 0 0 0 1px var(--color-border)" }}
              >
                Older →
              </button>
            </div>
          </>
        )}
      </SectionErrorBoundary>

      <Footer />
    </div>
  );
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-[0.16em] transition-colors border"
      style={
        active
          ? {
              background: "oklch(0.78 0.18 70 / 10%)",
              borderColor: "oklch(0.78 0.18 70 / 55%)",
              color: "var(--color-fg)",
            }
          : { borderColor: "var(--color-border)", color: "var(--color-fg-subtle)" }
      }
    >
      {label}
    </button>
  );
}
