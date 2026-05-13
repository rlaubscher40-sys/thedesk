/**
 * Top-of-page banner shown when the server is running on seed data. Lit by
 * a tRPC sentinel query — if `system.demoMode` returns true, the app draws
 * a tiny ribbon so reviewers know the data isn't real.
 */
import { Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";

export function DemoModeBanner() {
  const { data } = trpc.system.demoMode.useQuery(undefined, {
    staleTime: Infinity,
  });
  if (!data?.demoMode) return null;
  return (
    <div
      role="status"
      className="bg-amber-500/10 border-b border-amber-500/30 text-amber-200 text-xs px-4 py-1.5 flex items-center justify-center gap-2"
    >
      <Sparkles className="h-3 w-3" />
      <span className="font-mono uppercase tracking-wider">
        Demo mode · seed data, no live database
      </span>
    </div>
  );
}
