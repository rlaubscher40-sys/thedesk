/**
 * Admin console.
 *
 * Single page that surfaces every admin-only operation in one place:
 *   · Backfill Ruben's Take across every edition missing one
 *   · Per-edition status table with quick links into the edition reader
 *     so the EditionAdminPanel (regenerate Take, generate Substack
 *     draft, regenerate image, save edits) is one click away
 *   · Surface counts: total editions, drafts saved, takes missing
 *
 * Non-admin users see a forbidden card.
 */
import { Link } from "wouter";
import { ArrowRight, CheckCircle2, FileText, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { LinkedInAdminPanel } from "@/components/admin/LinkedInAdminPanel";
import { MetricsAdminPanel } from "@/components/admin/MetricsAdminPanel";
import { SubscribersAdminPanel } from "@/components/admin/SubscribersAdminPanel";
import { BackfillRubensTakeButton } from "@/components/editions/EditionAdminPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/useAuth";
import { trpc } from "@/lib/trpc";

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const listQuery = trpc.editions.list.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-1/4" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-64 w-full rounded" />
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="max-w-2xl mx-auto">
        <PageHeader overline="Admin" title="Forbidden" />
        <p className="text-sm text-[var(--color-fg-muted)]">
          The admin console is only available to users with the admin role. If
          this is wrong, ask the owner to promote your account.
        </p>
      </div>
    );
  }

  const editions = listQuery.data ?? [];
  const total = editions.length;
  const drafts = editions.filter((e) => e.hasDraft).length;
  const missingTake = editions.filter((e) => !e.rubensTake).length;

  return (
    <div>
      <PageHeader
        overline="The Desk · Admin"
        title="Console"
        kicker="Edition health, drafts, and bulk operations. Read-only counters at the top; per-edition actions below."
        actions={<BackfillRubensTakeButton />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px panel rounded overflow-hidden mb-10">
        <StatTile label="Editions" value={total} />
        <StatTile
          label="Substack drafts saved"
          value={drafts}
          accent="oklch(0.78 0.18 70)"
          icon={FileText}
        />
        <StatTile
          label="Editions missing a take"
          value={missingTake}
          accent={missingTake > 0 ? "oklch(0.68 0.20 15)" : "oklch(0.72 0.17 155)"}
          icon={missingTake > 0 ? Sparkles : CheckCircle2}
        />
      </div>

      <SectionErrorBoundary section="Edition table">
        {listQuery.isLoading ? (
          <Skeleton className="h-64 w-full rounded" />
        ) : editions.length === 0 ? (
          <div className="panel p-6 rounded text-sm text-[var(--color-fg-muted)]">
            No editions published yet.
          </div>
        ) : (
          <div className="panel rounded overflow-hidden">
            <div className="grid grid-cols-[60px_minmax(0,1fr)_140px_120px_120px_72px] items-center gap-4 px-5 py-3 border-b border-[var(--color-border)] overline">
              <span>No.</span>
              <span>Week</span>
              <span>Take</span>
              <span>Draft</span>
              <span>Hero image</span>
              <span className="text-right">Open</span>
            </div>
            <ul>
              {editions.map((ed, idx) => (
                <li
                  key={ed.id}
                  className={cn(
                    "grid grid-cols-[60px_minmax(0,1fr)_140px_120px_120px_72px] items-center gap-4 px-5 py-3 text-sm border-b border-[var(--color-border)] last:border-b-0 hover:bg-white/[0.02] transition-colors",
                    idx === 0 && "bg-amber-500/[0.03]"
                  )}
                >
                  <span className="font-mono tabular-nums text-[var(--color-fg-muted)]">
                    {ed.editionNumber}
                  </span>
                  <span className="font-serif truncate">{ed.weekRange}</span>
                  <StatusPill ok={!!ed.rubensTake} okLabel="In place" failLabel="Missing" />
                  <StatusPill ok={ed.hasDraft} okLabel="Saved" failLabel="—" neutral={!ed.hasDraft} />
                  <StatusPill
                    ok={!!ed.heroImageUrl}
                    okLabel="Set"
                    failLabel="—"
                    neutral={!ed.heroImageUrl}
                  />
                  <Link
                    href={`/editions/${ed.editionNumber}`}
                    className="inline-flex items-center justify-end gap-1 overline-amber hover:text-amber-200 transition-colors"
                  >
                    Open
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionErrorBoundary>

      <div className="mt-10">
        <SectionErrorBoundary section="Metrics admin">
          <MetricsAdminPanel />
        </SectionErrorBoundary>
      </div>

      <div className="mt-10">
        <SectionErrorBoundary section="Subscribers admin">
          <SubscribersAdminPanel />
        </SectionErrorBoundary>
      </div>

      <div className="mt-10">
        <SectionErrorBoundary section="LinkedIn admin">
          <LinkedInAdminPanel />
        </SectionErrorBoundary>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  accent = "oklch(0.78 0.18 70)",
  icon: Icon,
}: {
  label: string;
  value: number;
  accent?: string;
  icon?: typeof CheckCircle2;
}) {
  return (
    <div className="bg-[var(--color-bg-elevated)] p-5">
      <div className="flex items-center justify-between mb-3">
        <p
          className="overline truncate"
          style={{ letterSpacing: "0.16em" }}
          title={label}
        >
          {label}
        </p>
        {Icon && <Icon className="h-3.5 w-3.5" style={{ color: accent }} />}
      </div>
      <p
        className="font-serif text-4xl font-bold tabular-nums leading-none"
        style={{ color: accent }}
      >
        {value}
      </p>
    </div>
  );
}

function StatusPill({
  ok,
  okLabel,
  failLabel,
  neutral = false,
}: {
  ok: boolean;
  okLabel: string;
  failLabel: string;
  neutral?: boolean;
}) {
  const colour = ok
    ? "oklch(0.72 0.17 155)"
    : neutral
      ? "var(--color-fg-subtle)"
      : "oklch(0.68 0.20 15)";
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono uppercase text-[10px] tracking-[0.16em]"
      style={{ color: colour }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: colour }}
        aria-hidden="true"
      />
      {ok ? okLabel : failLabel}
    </span>
  );
}
