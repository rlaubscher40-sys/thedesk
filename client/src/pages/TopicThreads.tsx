/**
 * Topics. Two views:
 *   /topics            → overview grid of all categories with most-recent items
 *   /topics/:category  → drill-down: feed items + editions matching that cat
 */
import { Link, useParams } from "wouter";
import type { DailyFeedItem } from "@shared/types";
import { PageHeader } from "@/components/PageHeader";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/Skeleton";
import { categoryAccentClass, categoryColour } from "@/lib/category";
import { cn } from "@/lib/cn";
import { trpc } from "@/lib/trpc";

export default function TopicThreadsPage() {
  const params = useParams<{ category?: string }>();
  if (params.category) return <CategoryDrillDown category={params.category} />;
  return <CategoryOverview />;
}

function CategoryOverview() {
  const recentQuery = trpc.topics.recentByCategory.useQuery();
  const countsQuery = trpc.topics.itemCounts.useQuery();
  const counts = new Map<string, number>(
    (countsQuery.data ?? []).map((r) => [r.category, r.total])
  );

  return (
    <div>
      <PageHeader
        overline="The Desk · Topics"
        title="Threads by category"
        kicker="Open a category to see the running thread of feed items and weekly deep-dives."
      />
      <SectionErrorBoundary section="Topic overview">
        {recentQuery.isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded" />
            ))}
          </div>
        ) : recentQuery.data ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(recentQuery.data)
              .sort(([a], [b]) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
              .map(([category, items]) => (
                <CategoryCard
                  key={category}
                  category={category}
                  items={items}
                  total={counts.get(category) ?? items.length}
                />
              ))}
          </div>
        ) : null}
      </SectionErrorBoundary>
    </div>
  );
}

function CategoryCard({
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
      className={cn("block panel panel-hover rounded p-5", categoryAccentClass(category))}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="overline" style={{ color: categoryColour(category) }}>
          {category}
        </p>
        <span className="font-mono text-xs text-[var(--color-fg-subtle)]">{total} items</span>
      </div>
      <ul className="space-y-2.5">
        {items.slice(0, 3).map((item, idx) => (
          <li key={item.id || `item-${idx}`} className="text-sm leading-snug">
            <span className="line-clamp-2 text-[var(--color-fg-muted)]">{item.title}</span>
          </li>
        ))}
      </ul>
    </Link>
  );
}

function CategoryDrillDown({ category }: { category: string }) {
  const drill = trpc.topics.getByCategory.useQuery({ category });

  return (
    <div>
      <PageHeader
        overline={`Topic · ${category.toUpperCase()}`}
        title={`${category.charAt(0).toUpperCase()}${category.slice(1).toLowerCase()} thread`}
        kicker={
          <span>
            <Link href="/topics" className="hover:text-amber-300 underline underline-offset-2">
              All topics
            </Link>
          </span>
        }
      />
      <SectionErrorBoundary section="Drill-down">
        {drill.isLoading ? (
          <Skeleton className="h-64 w-full rounded" />
        ) : !drill.data ? null : (
          <div className="space-y-10">
            {drill.data.feedItems.length > 0 && (
              <section>
                <p className="overline mb-3">Daily feed ({drill.data.feedItems.length})</p>
                <ul className="space-y-3">
                  {drill.data.feedItems.map((item) => (
                    <li
                      key={item.id}
                      className={cn("panel panel-hover rounded p-4", categoryAccentClass(item.category))}
                    >
                      <Link
                        href={`/story/${item.id}`}
                        className="block hover:text-amber-300 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="overline">{item.source}</span>
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

            {drill.data.editions.length > 0 && (
              <section>
                <p className="overline mb-3">Editions ({drill.data.editions.length})</p>
                <ul className="space-y-3">
                  {drill.data.editions.map((ed) => (
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

            {drill.data.feedItems.length === 0 && drill.data.editions.length === 0 && (
              <div className="panel p-6 rounded text-sm text-[var(--color-fg-muted)]">
                Nothing under {category} yet.
              </div>
            )}
          </div>
        )}
      </SectionErrorBoundary>
    </div>
  );
}
