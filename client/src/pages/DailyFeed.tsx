/**
 * Today — magazine front page.
 *
 *   1. PageHeader (overline, masthead-style title, kicker)
 *   2. Date picker
 *   3. Lead story spans the full width — hero plate left, editorial column
 *      right, asymmetric grid
 *   4. Supporting stories below in a balanced 1-2-3 column grid that
 *      collapses gracefully on narrow screens
 *
 * Section-level boundaries and skeleton states preserved.
 */
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { PageHeader } from "@/components/PageHeader";
import { StaggerList } from "@/components/StaggerList";
import { FeedDatePicker } from "@/components/feed/FeedDatePicker";
import { FeedItemCard } from "@/components/feed/FeedItemCard";
import { FeedLeadCard } from "@/components/feed/FeedLeadCard";
import { FeedSkeleton } from "@/components/feed/FeedSkeleton";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { getSydneyIsoDate } from "@/lib/date";
import { trpc } from "@/lib/trpc";

export default function DailyFeed() {
  const [selectedDate, setSelectedDate] = useState<string>(getSydneyIsoDate);

  const datesQuery = trpc.feed.getRecentDates.useQuery();
  const feedQuery = trpc.feed.getByDate.useQuery({ date: selectedDate });

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

  const items = feedQuery.data ?? [];
  const [lead, ...rest] = items;

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

      <div className="mt-8 space-y-8">
        <SectionErrorBoundary section="Feed items">
          {feedQuery.isLoading ? (
            <FeedSkeleton />
          ) : items.length === 0 ? (
            <EmptyFeed date={niceDate} />
          ) : (
            <>
              {/* Lead story. */}
              {lead && <FeedLeadCard item={lead} />}

              {/* Supporting deck — 1 col mobile, 2 cols tablet, 3 cols wide. */}
              {rest.length > 0 && (
                <>
                  <div className="flex items-center gap-3">
                    <p className="overline-amber" style={{ letterSpacing: "0.2em" }}>
                      Today's deck
                    </p>
                    <span
                      className="block flex-1"
                      style={{
                        height: "1px",
                        background:
                          "linear-gradient(90deg, oklch(0.75 0.18 70 / 30%), transparent)",
                      }}
                      aria-hidden="true"
                    />
                  </div>
                  <StaggerList
                    className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5"
                    cacheKey={selectedDate}
                  >
                    {rest.map((item) => (
                      <FeedItemCard key={item.id} item={item} />
                    ))}
                  </StaggerList>
                </>
              )}
            </>
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
