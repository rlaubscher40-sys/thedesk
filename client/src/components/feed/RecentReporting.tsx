import type { DailyFeedItem } from "@shared/types";
import { Link } from "wouter";
import { coverageGroups } from "@shared/coverageGroups";
import { sourceTimingLabel } from "@shared/sourceTiming";
import { trpc } from "@/lib/trpc";
import { useFilteredFeed } from "@/lib/useFilteredFeed";
import { GUTTER_X } from "@/components/broadsheet/tokens";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConnectionNotice } from "@/components/ConnectionNotice";

export function RecentReporting({
  channel,
  beforeDate,
}: {
  channel: "AU" | "PROPERTY";
  beforeDate?: string;
}) {
  const query = trpc.feed.recentLocal.useQuery({ channel }, { staleTime: 60_000 });
  const items = useFilteredFeed(query.data ?? []).filter(
    (item) => !beforeDate || item.feedDate < beforeDate
  );
  if (query.isLoading)
    return (
      <section
        className={`${GUTTER_X} rule-hair py-8`}
        role="status"
        aria-label="Loading recent reporting"
        aria-busy="true"
      >
        <h2 className="bs-label">Recent reporting</h2>
        <p className="text-sm mt-2 mb-5 text-[var(--color-fg-muted)]">
          From the previous three days on The Desk.
        </p>
        <div className="grid md:grid-cols-2 gap-x-8" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="py-4 border-t border-[var(--color-border)] space-y-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-4 w-52 max-w-full" />
            </div>
          ))}
        </div>
      </section>
    );
  if (query.isError)
    return <ConnectionNotice retry={() => void query.refetch()} retrying={query.isFetching} />;
  return <RecentReportingList items={items} />;
}

type RecentStory = Pick<
  DailyFeedItem,
  | "id"
  | "title"
  | "summary"
  | "source"
  | "category"
  | "channel"
  | "feedDate"
  | "priority"
  | "threadParentId"
  | "sourceTiming"
>;
export function RecentReportingList({ items }: { items: RecentStory[] }) {
  const groups = coverageGroups(items)
    .sort(
      (a, b) => b.lead.feedDate.localeCompare(a.lead.feedDate) || b.lead.priority - a.lead.priority
    )
    .slice(0, 12);
  if (!groups.length) return null;
  return (
    <section className={`${GUTTER_X} rule-hair py-8`} aria-label="Recent reporting">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-5">
        <div>
          <h2 className="bs-label">Recent reporting</h2>
          <p className="text-sm mt-2 text-[var(--color-fg-muted)]">
            From the previous three days on The Desk.
          </p>
        </div>
        <Link href="/archive" className="bs-link text-sm">
          Browse the archive →
        </Link>
      </div>
      <ul className="grid md:grid-cols-2 gap-x-8">
        {groups.map(({ lead, related }) => (
          <li key={lead.id} className="py-4 border-t border-[var(--color-border)] min-w-0">
            <p className="bs-label mb-2">
              Filed <time dateTime={lead.feedDate}>{lead.feedDate}</time> · {lead.source}
            </p>
            <Link
              href={`/story/${lead.id}`}
              className="font-serif text-xl leading-snug hover:underline"
            >
              {lead.title}
            </Link>
            <p className="text-xs mt-2 text-[var(--color-fg-muted)]">
              {sourceTimingLabel(lead.sourceTiming)}
            </p>
            {!!related.length && (
              <details className="text-sm mt-3">
                <summary className="cursor-pointer">
                  {related.length} related {related.length === 1 ? "report" : "reports"}
                </summary>
                <ul className="space-y-2 mt-2">
                  {related.map((story) => (
                    <li key={story.id}>
                      <Link className="bs-link" href={`/story/${story.id}`}>
                        {story.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
