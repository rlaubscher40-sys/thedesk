import { NSW_PILOT_COUNCIL, NSW_PLANNING_ATTRIBUTION, NSW_PLANNING_DATASET } from "./nswPlanning";
import {
  followThroughFreshness,
  type MilestoneBasis,
  type ProjectFollowThrough,
} from "./projectFollowThrough";

export type ProjectFollowThroughData = {
  status: "available" | "unavailable";
  councilName: string;
  period: string | null;
  cohort: ProjectFollowThrough[];
  checks: number;
  lastCheckedAt: string | null;
};

const BASIS_LABEL: Record<MilestoneBasis, string> = {
  "confirmed-event": "Confirmed by the source",
  "source-state": "Source status, dated by its last change",
  promised: "Promised, not yet confirmed",
  "not-evidenced": "No evidence found",
};

function monthLabel(period: string): string {
  return new Date(`${period}-01T12:00:00Z`).toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function sydneyStamp(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "Unavailable";
  return parsed.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Australia/Sydney",
  });
}

function dayLabel(value: string): string {
  const parsed = new Date(value.length > 10 ? value : `${value}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: value.length > 10 ? "Australia/Sydney" : "UTC",
  });
}

function ProjectCard({ project }: { project: ProjectFollowThrough }) {
  return (
    <article className="rule-major pt-6 mt-8">
      <h2 className="font-serif text-2xl font-bold">
        {project.applicationId}
        <span className="block bs-label mt-2 font-sans">{project.councilName}</span>
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-[var(--color-fg-muted)]">
        {followThroughFreshness(project)}
      </p>

      <ol className="mt-6 grid gap-4" aria-label={`Milestones for ${project.applicationId}`}>
        {project.milestones.map((milestone) => (
          <li key={milestone.stage} className="rule-hair pt-3">
            <p className="font-semibold">
              {milestone.label}
              {milestone.on ? (
                <span className="font-normal"> · {dayLabel(milestone.on)}</span>
              ) : null}
            </p>
            <p className="bs-label mt-1">{BASIS_LABEL[milestone.basis]}</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">
              {milestone.detail}
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-6">
        <p className="bs-label">New dwellings reported by the source</p>
        {project.dwellingHistory.length > 1 ? (
          <>
            <ol className="mt-2 grid gap-1 text-sm">
              {project.dwellingHistory.map((entry) => (
                <li key={`${entry.sourceUpdatedAt}-${String(entry.value)}`}>
                  {entry.value === null ? "Not reported" : entry.value} · recorded{" "}
                  {dayLabel(entry.sourceUpdatedAt.slice(0, 10))}
                </li>
              ))}
            </ol>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">
              Each figure replaces the one before it. These are revisions of one application's
              count, not separate dwellings, and they are never added together.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm">
            {project.reportedDwellings === null
              ? "Not reported. An omitted count is not a count of zero."
              : `${project.reportedDwellings}. Unchanged across every read so far.`}
          </p>
        )}
      </div>

      {project.changes.length > 0 && (
        <div className="mt-6">
          <p className="bs-label">What changed</p>
          <ol className="mt-2 grid gap-1 text-sm">
            {project.changes.map((change) => (
              <li key={`${change.kind}-${change.observedAt}`}>
                {dayLabel(change.observedAt)} ·{" "}
                {change.kind === "status"
                  ? `status "${change.from}" → "${change.to}"`
                  : change.kind === "determination"
                    ? `determination date recorded: ${dayLabel(change.on)}`
                    : `dwellings ${change.from ?? "not reported"} → ${change.to ?? "not reported"}`}
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className="mt-5 text-sm text-[var(--color-fg-muted)]">
        {project.observations.length} distinct evidence{" "}
        {project.observations.length === 1 ? "state" : "states"} from{" "}
        {project.observations.length + project.repeatChecks} checks. Lodged{" "}
        {dayLabel(project.lodgedOn)}.
      </p>
    </article>
  );
}

/**
 * Renders with or without data: with no data it is the method and the limits,
 * which is what a crawler and a JavaScript-less reader get, and what the page
 * shows while the cohort loads or when no vintage has been retained yet.
 */
export function ProjectFollowThroughRead({
  data,
  loading = false,
}: {
  data?: ProjectFollowThroughData;
  loading?: boolean;
}) {
  const available = data?.status === "available" && data.cohort.length > 0;
  return (
    <main className="max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
      <nav aria-label="Breadcrumb" className="bs-label mb-8 flex flex-wrap gap-3">
        <a className="bs-link" href="/">
          The Desk
        </a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Project follow-through</span>
      </nav>

      <header className="max-w-3xl">
        <p className="bs-label-accent">Follow-through · {NSW_PILOT_COUNCIL}</p>
        <h1 className="font-serif font-bold mt-4 text-4xl sm:text-6xl tracking-tight leading-[1.06]">
          What happened after the application?
        </h1>
        <p className="mt-6 text-lg sm:text-xl leading-relaxed text-[var(--color-fg-muted)]">
          An announcement is not an application, an application is not a determination, and a
          determination is not a home. The Desk re-reads the same free NSW planning source on a
          fixed schedule and keeps every dated read, so a small cohort of applications can be
          followed rather than reported once and dropped.
        </p>
      </header>

      <section aria-label="How to read this" className="rule-major mt-10 pt-7 max-w-3xl">
        <h2 className="font-serif text-2xl font-bold">How to read this</h2>
        <ul className="mt-4 grid gap-3 leading-relaxed text-[var(--color-fg-muted)]">
          <li>
            <strong className="text-[var(--color-fg)]">A determination is not an approval.</strong>{" "}
            The source publishes that a determination was made and when. It does not publish whether
            the application was approved or refused, so this page never says approved.
          </li>
          <li>
            <strong className="text-[var(--color-fg)]">
              Construction and completion are not tracked.
            </strong>{" "}
            No connected source reports building starts or completions for an individual
            application, so those stages stay marked as no evidence found rather than assumed.
          </li>
          <li>
            <strong className="text-[var(--color-fg)]">
              An unchanged record is not a report of no progress.
            </strong>{" "}
            When a check finds the same evidence as the last one, this page says so, and does not
            move the project along.
          </li>
          <li>
            <strong className="text-[var(--color-fg)]">
              Dwelling counts are revised, not added.
            </strong>{" "}
            A changed count replaces the earlier figure for that application. Modification and
            review applications are excluded: the source does not publish which application they
            modify, so counting them would double-count.
          </li>
        </ul>
      </section>

      {loading && !available && (
        <p className="mt-10 rule-major pt-7" role="status">
          Loading the cohort…
        </p>
      )}

      {available && data && (
        <>
          <p className="mt-10 bs-label">
            Cohort: applications lodged in {monthLabel(data.period!)} · {data.cohort.length}{" "}
            followed · {data.checks} retained {data.checks === 1 ? "read" : "reads"} · last checked{" "}
            {data.lastCheckedAt ? sydneyStamp(data.lastCheckedAt) : "unavailable"}
          </p>
          {data.cohort.map((project) => (
            <ProjectCard key={project.projectId} project={project} />
          ))}
        </>
      )}

      {!loading && data && !available && (
        <p className="mt-10 rule-major pt-7 leading-relaxed" role="status">
          No cohort is available to follow yet. This page publishes only retained, complete reads of
          the planning source; it does not estimate a timeline or show a partial one.
        </p>
      )}

      <section aria-label="Source and licence" className="rule-major mt-12 pt-7 max-w-3xl">
        <h2 className="font-serif text-2xl font-bold">Source and licence</h2>
        <p className="mt-4 leading-relaxed text-[var(--color-fg-muted)]">
          NSW Online DA public data, read directly from the NSW Planning Portal's free,
          unauthenticated feed.{" "}
          <a className="bs-link underline" href={NSW_PLANNING_DATASET} rel="noopener noreferrer">
            Dataset and terms ↗
          </a>
          . {NSW_PLANNING_ATTRIBUTION}. Licensed CC BY 4.0. The Desk aggregates source records and
          adds no estimate of its own.
        </p>
        <p className="mt-4 leading-relaxed text-[var(--color-fg-muted)]">
          <a className="bs-link underline" href="/signals#nsw-planning">
            The council-month totals behind this cohort
          </a>{" "}
          ·{" "}
          <a className="bs-link underline" href="/guides/housing-supply">
            When does a housing announcement become a home?
          </a>
        </p>
        <p className="mt-4 text-sm leading-relaxed text-[var(--color-fg-muted)]">
          PlanningAlerts is a useful public benchmark for this kind of tracking. Its free API plan
          is restricted to non-commercial use, so The Desk does not retrieve or republish its data.{" "}
          <a
            className="bs-link underline"
            href="https://www.planningalerts.org.au/"
            rel="noopener noreferrer"
          >
            PlanningAlerts ↗
          </a>
        </p>
      </section>
    </main>
  );
}
