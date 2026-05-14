/**
 * Today is the daily scan. The page is intentionally small — the heavy
 * rendering lives in the focused sub-components under components/feed/.
 *
 * Improvements addressed here:
 *  - Loading skeletons (issue #4)
 *  - Section-level error boundaries (issue #3)
 *  - Optimistic queue updates flow through FeedItemCard (issue #10)
 */
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { PageHeader } from "@/components/PageHeader";
import { FeedDatePicker } from "@/components/feed/FeedDatePicker";
import { FeedItemCard } from "@/components/feed/FeedItemCard";
import { FeedSkeleton } from "@/components/feed/FeedSkeleton";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { getSydneyIsoDate } from "@/lib/date";
import { trpc } from "@/lib/trpc";

export default function DailyFeed() {
  const [selectedDate, setSelectedDate] = useState<string>(getSydneyIsoDate);

  const datesQuery = trpc.feed.getRecentDates.useQuery();
  const feedQuery = trpc.feed.getByDate.useQuery({ date: selectedDate });

  // If the user lands on a day with no feed, fall back to the latest available.
  useEffect(() => {
    if (!feedQuery.isLoading && feedQuery.data?.length === 0 && datesQuery.data?.[0]) {
      const latest = datesQuery.data[0];
      if (latest !== selectedDate) setSelectedDate(latest);
    }
  }, [feedQuery.data, feedQuery.isLoading, datesQuery.data, selectedDate]);

  const niceDate = (() => {
    try {
      return format(parseISO(selectedDate), "EEEE, d MMM yyyy");
    } catch {
      return selectedDate;
    }
  })();

  return (
    <div>
      <PageHeader
        overline="The Desk · Today"
        title="60-second morning scan"
        kicker={niceDate}
      />

      <SectionErrorBoundary section="Date picker">
        {datesQuery.data && (
          <FeedDatePicker
            dates={datesQuery.data}
            selected={selectedDate}
            onSelect={setSelectedDate}
          />
        )}
      </SectionErrorBoundary>

      {/* Feed column. Caps at a generous reading width — wider than a
          newspaper column but narrower than the surrounding container — so
          the long-form body remains scannable. */}
      <div className="mt-8 max-w-4xl">
        <SectionErrorBoundary section="Feed items">
          {feedQuery.isLoading ? (
            <FeedSkeleton />
          ) : feedQuery.data && feedQuery.data.length > 0 ? (
            <div className="space-y-5">
              {feedQuery.data.map((item) => (
                <FeedItemCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <EmptyFeed date={niceDate} />
          )}
        </SectionErrorBoundary>
      </div>
    </div>
  );
}

function EmptyFeed({ date }: { date: string }) {
  return (
    <div className="panel p-8 rounded text-center">
      <p className="overline mb-2">No feed items</p>
      <p className="text-sm text-[var(--color-fg-muted)]">
        Nothing landed for {date} yet. The 7am AEST scan posts here automatically.
      </p>
    </div>
  );
}
