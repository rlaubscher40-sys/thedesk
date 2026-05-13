/**
 * Conversation tracker. Read-only log of every Say This line the user has
 * copied. Adding rows happens automatically inside SayThisLine and
 * TalkingPointsBlock, so this page just renders the history.
 */
import { useMemo } from "react";
import { format } from "date-fns";
import { PageHeader } from "@/components/PageHeader";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/useAuth";
import { trpc } from "@/lib/trpc";

export default function ConversationTrackerPage() {
  const { isAuthenticated } = useAuth();
  const listQuery = trpc.conversations.list.useQuery(undefined, { enabled: isAuthenticated });

  // Group conversation entries by day before the conditional return so the
  // hook order stays stable.
  const grouped = useMemo(() => {
    const data = listQuery.data ?? [];
    const byDay: Record<string, typeof data> = {};
    for (const entry of data) {
      const day = format(new Date(entry.usedAt), "EEEE d MMM yyyy");
      byDay[day] ??= [];
      byDay[day]!.push(entry);
    }
    return Object.entries(byDay);
  }, [listQuery.data]);

  if (!isAuthenticated) {
    return (
      <div>
        <PageHeader overline="The Desk · Tracker" title="Sign in to track conversations" />
        <p className="text-sm text-[var(--color-fg-muted)]">
          The tracker is private to your account. Sign in to keep a history.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        overline="The Desk · Tracker"
        title="Conversations log"
        kicker="Every Say This line and talking point you've copied lives here."
      />

      <SectionErrorBoundary section="Tracker">
        {listQuery.isLoading ? (
          <TrackerSkeleton />
        ) : grouped.length === 0 ? (
          <div className="panel p-8 rounded text-center text-sm text-[var(--color-fg-muted)]">
            Copy a Say This line from the daily feed and it'll log here.
          </div>
        ) : (
          <ol className="space-y-8">
            {grouped.map(([day, entries]) => (
              <li key={day}>
                <p className="overline mb-3">{day}</p>
                <ul className="space-y-2">
                  {entries.map((entry) => (
                    <li key={entry.id} className="panel p-3 rounded">
                      <div className="flex items-start gap-3">
                        <span className="overline pt-0.5 shrink-0">
                          {format(new Date(entry.usedAt), "HH:mm")}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-relaxed">"{entry.lineText}"</p>
                          {entry.usedWithCategory && (
                            <p className="overline mt-1">with {entry.usedWithCategory}</p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </SectionErrorBoundary>
    </div>
  );
}

function TrackerSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-14 w-full rounded" />
          <Skeleton className="h-14 w-full rounded" />
        </div>
      ))}
    </div>
  );
}
