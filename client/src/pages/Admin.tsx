import { TaskDetails } from "@/components/admin/TaskDetails";
import { LegalAdminPanel } from "@/components/admin/LegalAdminPanel";
import { OperationsOverview } from "@/components/admin/OperationsOverview";
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
import { Link, useSearch } from "wouter";
import { ArrowRight, CheckCircle2, FileText, Lock, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { AnalyticsAdminPanel } from "@/components/admin/AnalyticsAdminPanel";
import { FeedbackAdminPanel } from "@/components/admin/FeedbackAdminPanel";
import { CoverageRequestPanel } from "@/components/admin/CoverageRequestPanel";
import { HealthAdminPanel } from "@/components/admin/HealthAdminPanel";
import { HeroLibraryAdminPanel } from "@/components/admin/HeroLibraryAdminPanel";
import { InstagramAdminPanel } from "@/components/admin/InstagramAdminPanel";
import { LinkedInAdminPanel } from "@/components/admin/LinkedInAdminPanel";
import { MaintenanceAdminPanel } from "@/components/admin/MaintenanceAdminPanel";
import { MetricsAdminPanel } from "@/components/admin/MetricsAdminPanel";
import { ServicesAdminPanel } from "@/components/admin/ServicesAdminPanel";
import { SubscribersAdminPanel } from "@/components/admin/SubscribersAdminPanel";
import {
  EditionAdminPanel,
  BackfillRubensTakeButton,
} from "@/components/editions/EditionAdminPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/useAuth";
import { trpc } from "@/lib/trpc";

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const section = params.get("section") ?? "overview";
  const selectedEdition = Number(params.get("edition"));
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
        <PageHeader overline="Admin" title={user ? "Forbidden" : "Sign in to continue"} />
        <p className="text-sm text-[var(--color-fg-muted)] mb-5">
          {user
            ? "The admin console is only available to users with the admin role. If this is wrong, ask the owner to promote your account."
            : "The admin console is curator-only. Sign in with the admin password to continue."}
        </p>
        {!user && (
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded px-4 py-2.5 text-[0.75rem] font-mono uppercase tracking-[0.18em] transition-all active:scale-[0.98]"
            style={{
              background: "var(--grad-cta-amber)",
              color: "var(--color-on-amber)",
              boxShadow: "0 1px 0 oklch(1 0 0 / 18%) inset, 0 4px 14px oklch(0.75 0.18 70 / 28%)",
            }}
          >
            <Lock className="h-3 w-3" />
            Sign in
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
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
        title="Curator workspace"
        kicker="Check what needs attention, then open the tools for the task."
      />

      <nav aria-label="Curator sections" className="flex flex-wrap gap-2 mb-6">
        {["overview", "stories", "social", "data", "settings"].map((name) => (
          <Link
            key={name}
            href={`/admin?section=${name}`}
            aria-current={section === name ? "page" : undefined}
            className={`bs-btn ${section === name ? "bs-btn-solid" : "bs-btn-outline"}`}
          >
            {name.charAt(0).toUpperCase() + name.slice(1)}
          </Link>
        ))}
      </nav>
      {section === "overview" && <OperationsOverview />}
      {(section === "settings" || section === "stories") && (
        <SectionErrorBoundary section="Publishing controls">
          <LegalAdminPanel />
        </SectionErrorBoundary>
      )}
      {section === "social" && (
        <div id="instagram" className="my-8 scroll-mt-20">
          <SectionErrorBoundary section="Instagram admin">
            <InstagramAdminPanel />
          </SectionErrorBoundary>
        </div>
      )}

      {section === "stories" && (
        <>
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
              <div className="panel rounded overflow-x-auto">
                <div className="grid min-w-[720px] grid-cols-[60px_minmax(0,1fr)_140px_120px_120px_72px] items-center gap-4 px-5 py-3 border-b border-[var(--color-border)] overline">
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
                        "grid min-w-[720px] grid-cols-[60px_minmax(0,1fr)_140px_120px_120px_72px] items-center gap-4 px-5 py-3 text-sm border-b border-[var(--color-border)] last:border-b-0 hover:bg-white/[0.02] transition-colors",
                        idx === 0 && "bg-amber-500/[0.03]"
                      )}
                    >
                      <span className="font-mono tabular-nums text-[var(--color-fg-muted)]">
                        {ed.editionNumber}
                      </span>
                      <span className="font-serif truncate">{ed.weekRange}</span>
                      <StatusPill ok={!!ed.rubensTake} okLabel="In place" failLabel="Missing" />
                      <StatusPill
                        ok={ed.hasDraft}
                        okLabel="Saved"
                        failLabel="—"
                        neutral={!ed.hasDraft}
                      />
                      <StatusPill
                        ok={!!ed.heroImageUrl}
                        okLabel="Set"
                        failLabel="—"
                        neutral={!ed.heroImageUrl}
                      />
                      <Link
                        href={`/admin?section=stories&edition=${ed.editionNumber}`}
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
          {editions.find((ed) => ed.editionNumber === selectedEdition) && (
            <EditionAdminPanel
              edition={editions.find((ed) => ed.editionNumber === selectedEdition)!}
            />
          )}
          <details className="mt-5">
            <summary className="bs-link min-h-11 py-3">Bulk edition maintenance</summary>
            <p className="text-sm mb-4">Generate takes for editions currently missing one.</p>
            <BackfillRubensTakeButton />
          </details>
        </>
      )}

      {/* Service health sits at the top of the admin chrome so any
          incidents (errors stacking up, uptime dropping, ingest stale)
          are the first thing the curator sees on /admin. */}
      {section === "data" && (
        <TaskDetails title="Service health">
          <SectionErrorBoundary section="Service health">
            <HealthAdminPanel />
          </SectionErrorBoundary>
        </TaskDetails>
      )}

      {/* Feedback inbox sits near the top of the admin so new
          submissions are the first thing the editor sees on /admin. */}
      {/* Service dependencies: the full catalogue of what the site relies
          on (DB, hosting, AI, email, social, automation) with per-service
          status and links out to each provider's status page. Sits right
          under the health summary so infra is grouped together. */}
      {section === "settings" && (
        <TaskDetails title="Service dependencies">
          <SectionErrorBoundary section="Service dependencies">
            <ServicesAdminPanel />
          </SectionErrorBoundary>
        </TaskDetails>
      )}

      {section === "overview" && (
        <TaskDetails title="Feedback inbox">
          <SectionErrorBoundary section="Feedback inbox">
            <FeedbackAdminPanel />
          </SectionErrorBoundary>
        </TaskDetails>
      )}

      {section === "overview" && (
        <TaskDetails title="Coverage requests">
          <SectionErrorBoundary section="Coverage requests">
            <CoverageRequestPanel />
          </SectionErrorBoundary>
        </TaskDetails>
      )}

      {section === "data" && (
        <TaskDetails title="Metrics admin">
          <SectionErrorBoundary section="Metrics admin">
            <MetricsAdminPanel />
          </SectionErrorBoundary>
        </TaskDetails>
      )}

      {section === "settings" && (
        <TaskDetails title="Subscribers admin">
          <SectionErrorBoundary section="Subscribers admin">
            <SubscribersAdminPanel />
          </SectionErrorBoundary>
        </TaskDetails>
      )}

      {section === "social" && (
        <TaskDetails title="LinkedIn admin">
          <SectionErrorBoundary section="LinkedIn admin">
            <LinkedInAdminPanel />
          </SectionErrorBoundary>
        </TaskDetails>
      )}

      {section === "stories" && (
        <TaskDetails title="Hero library">
          <SectionErrorBoundary section="Hero library">
            <HeroLibraryAdminPanel />
          </SectionErrorBoundary>
        </TaskDetails>
      )}

      {section === "overview" && (
        <TaskDetails title="Analytics">
          <SectionErrorBoundary section="Analytics">
            <AnalyticsAdminPanel />
          </SectionErrorBoundary>
        </TaskDetails>
      )}

      {section === "settings" && (
        <TaskDetails title="Maintenance">
          <SectionErrorBoundary section="Maintenance">
            <MaintenanceAdminPanel />
          </SectionErrorBoundary>
        </TaskDetails>
      )}
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
        <p className="overline truncate" style={{ letterSpacing: "0.16em" }} title={label}>
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
      className="inline-flex items-center gap-1.5 font-mono uppercase text-[0.75rem] tracking-[0.16em]"
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
