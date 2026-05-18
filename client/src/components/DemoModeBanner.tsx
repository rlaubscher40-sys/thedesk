/**
 * Tiny "demo mode" indicator shown when the server is running on seed data.
 * Lit by a tRPC sentinel query, appears as a compact pill in the
 * bottom-right corner of the viewport rather than a full-width top banner,
 * so it tells developers and reviewers the data isn't real without
 * dominating the editorial frame.
 */
import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

export function DemoModeBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { data } = trpc.system.demoMode.useQuery(undefined, {
    staleTime: Infinity,
  });
  if (!data?.demoMode || dismissed) return null;
  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-[0.18em]"
      style={{
        background: "var(--color-banner-bg)",
        backdropFilter: "blur(6px)",
        color: "var(--color-amber)",
        boxShadow: "inset 0 0 0 1px oklch(0.78 0.18 70 / 28%)",
      }}
    >
      <Sparkles className="h-3 w-3" />
      <span>Demo mode</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss demo mode banner"
        className="ml-1 rounded p-0.5 hover:bg-white/10 transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
