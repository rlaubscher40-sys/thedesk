/**
 * Skeleton placeholder for a feed item card. Rendered as a list so the page
 * doesn't go blank while data loads (issue #4 in the brief).
 */
import { Skeleton } from "../ui/Skeleton";

export function FeedSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading today's feed">
      {Array.from({ length: count }).map((_, i) => (
        <FeedItemSkeleton key={i} />
      ))}
    </div>
  );
}

function FeedItemSkeleton() {
  return (
    <div className="panel p-5 rounded space-y-3">
      <div className="flex gap-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <div className="pt-3 mt-3 border-t border-[var(--color-border)] space-y-2">
        <Skeleton className="h-2.5 w-1/2" />
        <Skeleton className="h-2.5 w-2/3" />
        <Skeleton className="h-2.5 w-1/2" />
        <Skeleton className="h-2.5 w-3/5" />
      </div>
    </div>
  );
}
