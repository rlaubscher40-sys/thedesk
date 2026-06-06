/**
 * Admin-only warning strip that appears above the lead card when today's
 * hero hasn't earned its slot — i.e. the priority-top story was promoted to
 * lead as the fallback, not because it cleared the lead-worthiness gate in
 * DailyFeed.tsx.
 *
 * The hero treatment (Playfair display, hairline-divided source/take/angles
 * rows) is built to carry analytical context + the Say This + partner
 * angles. A story missing one of those still leads because the floor is
 * "there is always a lead" — but the admin should see immediately that the
 * day's lead is thin, and which of the three editorial moments is missing,
 * and have a one-click action to backfill from the LLM rather than scroll
 * over to the Admin console.
 *
 * Not visible to readers — gated on isAdmin.
 */
import { AlertTriangle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { DailyFeedItem } from "@shared/types";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/useAuth";

export function LeadEnrichmentWarning({ item }: { item: DailyFeedItem }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const enrich = trpc.feed.enrichItem.useMutation({
    onSuccess: (res) => {
      if (res.updated.length === 0) {
        toast.message("No new angles produced", {
          description:
            "The LLM returned SKIP for the missing fields — this story may not have a genuine partner-channel angle.",
        });
      } else {
        toast.success(`Enriched: ${res.updated.join(", ")}`);
      }
      utils.feed.getByDate.invalidate();
    },
    onError: (err) => toast.error(err.message ?? "Enrichment failed"),
  });

  if (!isAdmin) return null;

  // Compute the specific gaps so the warning names what's missing rather
  // than waving "this needs more work". The same predicates the lead
  // worthiness gate in DailyFeed uses.
  const gaps: string[] = [];
  if (!(item.summary?.trim() || item.whyItMatters?.trim())) gaps.push("context");
  if (!(item.sayThis?.trim() || item.rubensNote?.trim())) gaps.push("Say This");
  if (!item.partnerTag?.trim()) gaps.push("partner angles");

  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-3 rounded-sm px-4 py-3 text-[12.5px] text-[var(--color-fg-muted)] leading-relaxed"
      style={{
        background: "oklch(0.62 0.18 25 / 6%)",
        boxShadow: "inset 0 0 0 1px oklch(0.62 0.18 25 / 25%)",
      }}
    >
      <AlertTriangle
        className="h-3.5 w-3.5 mt-0.5 shrink-0"
        style={{ color: "oklch(0.72 0.20 28)" }}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p>
          <span className="font-medium text-[var(--color-fg)]">
            Today&apos;s lead hasn&apos;t earned its slot.
          </span>{" "}
          The priority-top story is missing{" "}
          <span className="font-medium text-[var(--color-fg)]">{gaps.join(", ")}</span>
          {" "}— the hero treatment is built to hold those. Fill the gaps below, or
          dig deeper into today&apos;s sources for a stronger candidate.
        </p>
      </div>
      <button
        type="button"
        onClick={() => enrich.mutate({ id: item.id })}
        disabled={enrich.isPending}
        className="inline-flex items-center gap-1.5 shrink-0 rounded px-3 py-1.5 text-[10.5px] font-mono uppercase tracking-[0.16em] transition-colors disabled:opacity-50"
        style={{
          background: "oklch(0.78 0.18 70 / 14%)",
          color: "var(--color-amber-bright)",
          boxShadow: "inset 0 0 0 1px oklch(0.78 0.18 70 / 40%)",
        }}
      >
        <Sparkles className="h-3 w-3" />
        {enrich.isPending ? "Enriching…" : "Enrich now"}
      </button>
    </div>
  );
}
