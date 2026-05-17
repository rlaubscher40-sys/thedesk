/**
 * One-tap maintenance affordances for editorial chores that previously
 * needed a SQL editor:
 *
 *   - Catch-up DB migrations (idempotent — safe to re-run)
 *   - Delete a thin / broken edition by edition number
 *   - Wipe all feed items / wipe all metrics (clean-slate reset before
 *     re-running the daily ingest workflows)
 *
 * The whole panel exists so the editor can recover the site from a phone
 * without opening TiDB Cloud's SQL editor (which is desktop-only).
 */
import { useState } from "react";
import { AlertTriangle, Database, Eraser, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type CatchupResult = {
  ok: boolean;
  demoMode: boolean;
  applied: string[];
  skipped: string[];
  failed: Array<{ name: string; message: string }>;
};

export function MaintenanceAdminPanel() {
  const [lastResult, setLastResult] = useState<CatchupResult | null>(null);
  const [editionNumber, setEditionNumber] = useState("");

  const catchup = trpc.system.catchupDatabase.useMutation({
    onSuccess: (res) => {
      setLastResult(res);
      if (res.failed.length === 0) {
        const summary =
          res.applied.length > 0
            ? `Applied ${res.applied.length}, skipped ${res.skipped.length}`
            : `All ${res.skipped.length} already applied`;
        toast.success(summary);
      } else {
        toast.error(`${res.failed.length} failed — see panel`);
      }
    },
    onError: (err) => toast.error(err.message ?? "Catch-up failed"),
  });

  const utils = trpc.useUtils();
  const deleteEdition = trpc.system.deleteEditionByNumber.useMutation({
    onSuccess: (res) => {
      if (res.deletedCount > 0) {
        toast.success(`Edition ${editionNumber} deleted`);
        setEditionNumber("");
        utils.editions.list.invalidate();
      } else {
        toast.info(`No edition with number ${editionNumber}`);
      }
    },
    onError: (err) => toast.error(err.message ?? "Delete failed"),
  });

  const purgeFeed = trpc.system.purgeFeed.useMutation({
    onSuccess: (res) => {
      toast.success(`Wiped ${res.deletedCount} feed item${res.deletedCount === 1 ? "" : "s"}`);
      utils.feed.getByDate.invalidate();
    },
    onError: (err) => toast.error(err.message ?? "Wipe failed"),
  });
  const purgeMetrics = trpc.system.purgeMetrics.useMutation({
    onSuccess: (res) => {
      toast.success(
        `Wiped ${res.deletedCount} metric${res.deletedCount === 1 ? "" : "s"}` +
          (res.historyDeletedCount
            ? ` + ${res.historyDeletedCount} history rows`
            : "")
      );
      utils.metrics.list.invalidate();
      utils.metrics.histories.invalidate();
    },
    onError: (err) => toast.error(err.message ?? "Wipe failed"),
  });

  function handleWipeFeed() {
    if (
      !confirm(
        "Wipe ALL feed items? This deletes every story in the daily feed across every date. Used before re-running the daily-feed workflow for a clean slate."
      )
    )
      return;
    purgeFeed.mutate({ confirm: "WIPE" });
  }
  function handleWipeMetrics() {
    if (
      !confirm(
        "Wipe ALL metrics + 30-day history? Used before re-running the daily-metrics workflow for a clean slate. Sparklines will redraw from scratch."
      )
    )
      return;
    purgeMetrics.mutate({ confirm: "WIPE" });
  }

  function handleDelete() {
    const n = parseInt(editionNumber, 10);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a valid edition number");
      return;
    }
    if (!confirm(`Delete edition ${n}? This can't be undone.`)) return;
    deleteEdition.mutate({ editionNumber: n });
  }

  return (
    <section className="panel rounded p-6 sm:p-8 space-y-6">
      <div>
        <p
          className="overline-amber mb-2"
          style={{ letterSpacing: "0.22em", fontSize: "10px" }}
        >
          Maintenance
        </p>
        <h2 className="font-serif text-2xl font-bold leading-tight">
          Database chores
        </h2>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1.5 max-w-[60ch]">
          Run schema catch-ups and clear bad editions from here when you can't
          get to the SQL editor.
        </p>
      </div>

      {/* Catch-up migrations. */}
      <div className="space-y-3">
        <div>
          <p className="overline mb-1.5" style={{ letterSpacing: "0.18em" }}>
            1 · Catch-up migrations
          </p>
          <p className="text-xs text-[var(--color-fg-subtle)] leading-relaxed max-w-[60ch]">
            Adds any columns and tables the new code expects. Safe to re-run —
            columns that already exist are skipped silently.
          </p>
        </div>
        <button
          onClick={() => catchup.mutate()}
          disabled={catchup.isPending}
          className="inline-flex items-center gap-2 rounded px-4 py-2 text-[10px] font-mono uppercase tracking-[0.18em] transition-all active:scale-[0.98] disabled:opacity-50"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.78 0.18 70) 0%, oklch(0.88 0.19 82) 55%, oklch(0.65 0.16 60) 100%)",
            color: "oklch(0.10 0.018 260)",
          }}
        >
          <Database className="h-3 w-3" />
          {catchup.isPending ? "Running…" : "Run catch-up"}
        </button>

        {lastResult && (
          <div className="mt-4 space-y-2 text-xs">
            {lastResult.demoMode && (
              <p className="text-amber-300 font-mono">
                Demo mode — nothing was actually run.
              </p>
            )}
            {lastResult.applied.length > 0 && (
              <ResultRow
                label="Applied"
                items={lastResult.applied}
                colour="oklch(0.72 0.17 155)"
              />
            )}
            {lastResult.skipped.length > 0 && (
              <ResultRow
                label="Already there"
                items={lastResult.skipped}
                colour="oklch(0.55 0.02 260)"
              />
            )}
            {lastResult.failed.length > 0 && (
              <div>
                <p
                  className="overline mb-1.5"
                  style={{ color: "oklch(0.68 0.20 15)" }}
                >
                  Failed
                </p>
                <ul className="space-y-1.5">
                  {lastResult.failed.map((f) => (
                    <li
                      key={f.name}
                      className="rounded-sm p-2 font-mono text-[11px]"
                      style={{
                        background: "oklch(0.68 0.20 15 / 8%)",
                        color: "oklch(0.78 0.16 15)",
                      }}
                    >
                      <p>{f.name}</p>
                      <p className="opacity-70 mt-0.5">{f.message}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete edition. */}
      <div className="space-y-3 pt-5 border-t border-[var(--color-border)]">
        <div>
          <p className="overline mb-1.5" style={{ letterSpacing: "0.18em" }}>
            2 · Delete an edition
          </p>
          <p className="text-xs text-[var(--color-fg-subtle)] leading-relaxed max-w-[60ch]">
            Clear a thin or broken edition by number so the weekly synthesis
            can rebuild it from scratch.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="Edition #"
            value={editionNumber}
            onChange={(e) => setEditionNumber(e.target.value)}
            className="w-32 px-3 py-2 rounded text-sm font-mono tabular-nums bg-black/20 border border-[var(--color-border)] focus:outline-none focus:border-amber-400/40 transition-colors"
          />
          <button
            onClick={handleDelete}
            disabled={deleteEdition.isPending || !editionNumber.trim()}
            className="inline-flex items-center gap-1.5 rounded px-3.5 py-2 text-[10px] font-mono uppercase tracking-[0.18em] transition-colors disabled:opacity-50"
            style={{
              background: "oklch(0.68 0.20 15 / 12%)",
              color: "oklch(0.78 0.16 15)",
              boxShadow: "inset 0 0 0 1px oklch(0.68 0.20 15 / 30%)",
            }}
          >
            <Trash2 className="h-3 w-3" />
            {deleteEdition.isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
        <p className="flex items-start gap-1.5 text-[10px] text-[var(--color-fg-subtle)] leading-relaxed">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-400/60" />
          <span>
            Deletes immediately. No soft-delete. Re-fire the Weekly Edition
            workflow after to regenerate.
          </span>
        </p>
      </div>

      {/* Clean-slate wipes — used before re-running the daily-feed and
          daily-metrics workflows when you want a fresh starting state. */}
      <div className="space-y-4 pt-5 border-t border-[var(--color-border)]">
        <div>
          <p
            className="overline mb-1.5"
            style={{ letterSpacing: "0.18em", color: "oklch(0.78 0.16 15)" }}
          >
            3 · Clean-slate wipes
          </p>
          <p className="text-xs text-[var(--color-fg-subtle)] leading-relaxed max-w-[60ch]">
            Reset the feed or the metrics tables before re-firing the
            corresponding GitHub Actions workflow. Each wipe is immediate
            and irreversible — confirmation prompt only.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleWipeFeed}
            disabled={purgeFeed.isPending}
            className="inline-flex items-center gap-1.5 rounded px-3.5 py-2 text-[10px] font-mono uppercase tracking-[0.18em] transition-colors disabled:opacity-50"
            style={{
              background: "oklch(0.68 0.20 15 / 12%)",
              color: "oklch(0.78 0.16 15)",
              boxShadow: "inset 0 0 0 1px oklch(0.68 0.20 15 / 30%)",
            }}
          >
            <Eraser className="h-3 w-3" />
            {purgeFeed.isPending ? "Wiping…" : "Wipe feed items"}
          </button>
          <button
            onClick={handleWipeMetrics}
            disabled={purgeMetrics.isPending}
            className="inline-flex items-center gap-1.5 rounded px-3.5 py-2 text-[10px] font-mono uppercase tracking-[0.18em] transition-colors disabled:opacity-50"
            style={{
              background: "oklch(0.68 0.20 15 / 12%)",
              color: "oklch(0.78 0.16 15)",
              boxShadow: "inset 0 0 0 1px oklch(0.68 0.20 15 / 30%)",
            }}
          >
            <Eraser className="h-3 w-3" />
            {purgeMetrics.isPending ? "Wiping…" : "Wipe metrics + history"}
          </button>
        </div>
        <p className="flex items-start gap-1.5 text-[10px] text-[var(--color-fg-subtle)] leading-relaxed">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-400/60" />
          <span>
            After wiping, manually re-fire the matching workflow on GitHub
            Actions: Daily Feed → Daily Metrics → Weekly Edition.
          </span>
        </p>
      </div>
    </section>
  );
}

function ResultRow({
  label,
  items,
  colour,
}: {
  label: string;
  items: string[];
  colour: string;
}) {
  return (
    <div>
      <p className="overline mb-1.5" style={{ color: colour, letterSpacing: "0.18em" }}>
        {label} · {items.length}
      </p>
      <ul className="space-y-1">
        {items.map((name) => (
          <li
            key={name}
            className="font-mono text-[11px] text-[var(--color-fg-muted)] truncate"
            title={name}
          >
            · {name}
          </li>
        ))}
      </ul>
    </div>
  );
}
