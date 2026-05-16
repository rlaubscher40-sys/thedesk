import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

/**
 * Generic shimmer skeleton block. Drop into anywhere a tile is loading.
 * The animation class lives in index.css under .skeleton.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton h-4 w-full", className)} aria-hidden="true" {...props} />;
}
