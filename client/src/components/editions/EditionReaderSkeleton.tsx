import { Skeleton } from "../ui/Skeleton";

export function EditionReaderSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="aspect-[3/1] w-full rounded" />
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-2/3" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px mt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <Skeleton className="h-44 w-full rounded mt-8" />
      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded" />
        ))}
      </div>
    </div>
  );
}
