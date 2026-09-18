/**
 * Project follow-through: what happened after the application was lodged.
 *
 * This reads only the dated vintages the NSW planning pilot already retains
 * (`planning_snapshots.records`). It adds no source, no API surface and no
 * estimate. Every stage below is either dated by the source, dated only by the
 * source's own "last updated" stamp, or explicitly not evidenced at all.
 *
 * What this source can and cannot say, and why the labels are worded the way
 * they are:
 *  - The NSW Online DA feed publishes a lodgement date, a status, an optional
 *    determination date and an optional new-dwelling count. It does not publish
 *    the outcome of a determination, so "Determined" is reported as a
 *    determination, never as an approval.
 *  - It does not publish construction starts or completions, and it does not
 *    publish a link from a modification application to the application it
 *    modifies. Both are reported as not evidenced rather than inferred.
 *  - A promised date (an announcement, a minister's timetable, a developer's
 *    schedule) has no field in this source. The shape carries promised
 *    milestones so editorial can supply one with its own citation; nothing here
 *    invents one.
 */
import {
  NSW_PLANNING_ATTRIBUTION,
  NSW_PLANNING_DATASET,
  nswPlanningWindow,
  type NswPlanningRecord,
} from "./nswPlanning";

/** One retained read of the source, with the per-application records it returned. */
export type PlanningVintage = {
  retrievedAt: string;
  fingerprint: string;
  records: NswPlanningRecord[];
};

type FollowThroughStage =
  | "proposal"
  | "application"
  | "assessment"
  | "determination"
  | "construction"
  | "completion";

/**
 * How a stage is dated.
 *  confirmed-event — the source publishes a date for the event itself.
 *  source-state    — the source publishes the state, dated only by the time it
 *                    last changed the record. The event happened on or before that.
 *  promised        — a date someone said would happen. Never derived from this feed.
 *  not-evidenced   — no connected source reports this stage at all.
 */
export type MilestoneBasis = "confirmed-event" | "source-state" | "promised" | "not-evidenced";

type ProjectMilestone = {
  stage: FollowThroughStage;
  label: string;
  basis: MilestoneBasis;
  /** ISO date for confirmed events; ISO timestamp for source-state; null when not evidenced. */
  on: string | null;
  detail: string;
};

type ProjectObservation = {
  /** When The Desk read the source. */
  observedAt: string;
  /** When the source says it last changed this record. */
  sourceUpdatedAt: string;
  status: NswPlanningRecord["status"];
  determinedOn: string | null;
  proposedDwellings: number | null;
};

type ProjectChange =
  | {
      kind: "status";
      from: NswPlanningRecord["status"];
      to: NswPlanningRecord["status"];
      sourceUpdatedAt: string;
      observedAt: string;
    }
  | { kind: "determination"; on: string; sourceUpdatedAt: string; observedAt: string }
  | {
      kind: "dwellings";
      from: number | null;
      to: number | null;
      sourceUpdatedAt: string;
      observedAt: string;
    };

export type ProjectFollowThrough = {
  projectId: string;
  applicationId: string;
  councilName: string;
  applicationType: NswPlanningRecord["applicationType"];
  lodgedOn: string;
  /** Distinct evidence states, oldest first. Repeated identical reads are folded. */
  observations: ProjectObservation[];
  /** Reads that returned the same evidence as the read before them. */
  repeatChecks: number;
  changes: ProjectChange[];
  milestones: ProjectMilestone[];
  /**
   * Every dwelling count the source has reported for THIS application, with the
   * stamp it changed on. A revision replaces an earlier figure; the figures are
   * never added together.
   */
  dwellingHistory: { value: number | null; sourceUpdatedAt: string }[];
  reportedDwellings: number | null;
  latestSourceUpdatedAt: string;
  lastCheckedAt: string;
  /** Set when the most recent check found nothing newer than the evidence already held. */
  noNewerEvidenceSince: string | null;
  source: { dataset: string; attribution: string; licence: string };
};

const FOLLOW_THROUGH_LICENCE = "CC BY 4.0";

const STAGE_ORDER: FollowThroughStage[] = [
  "proposal",
  "application",
  "assessment",
  "determination",
  "construction",
  "completion",
];

/** Statuses that evidence an application sitting with the consent authority. */
const ASSESSMENT_STATUSES = new Set<NswPlanningRecord["status"]>([
  "Under Assessment",
  "Additional Information Requested",
  "On Exhibition",
  "Pending Court Appeal",
  "Deferred Commencement",
]);

/** Statuses that close the application without a published determination outcome. */
const CLOSED_STATUSES = new Set<NswPlanningRecord["status"]>(["Withdrawn", "Rejected"]);

/**
 * Stable identity. The planning portal application number is unique across NSW
 * and does not change when the application's status, dwelling count or council
 * record changes, so it is the identity rather than a hash of mutable fields.
 */
export function projectIdentity(applicationId: string): string | null {
  const match = /^PAN-(\d{1,20})$/.exec(applicationId.trim());
  return match ? `pan-${match[1]}` : null;
}

export function projectApplicationId(projectId: string): string | null {
  const match = /^pan-(\d{1,20})$/.exec(projectId.trim());
  return match ? `PAN-${match[1]}` : null;
}

/**
 * A small cohort, chosen deterministically so the same evidence always produces
 * the same list. Original development applications only: a modification or a
 * review is a change to an application this feed does not name, so following one
 * as a project of its own would double-count the dwellings behind it.
 */
export function selectFollowThroughCohort(records: NswPlanningRecord[], limit: number): string[] {
  if (!Number.isInteger(limit) || limit < 1) return [];
  const seen = new Set<string>();
  return records
    .filter((record) => record.applicationType === "Development Application")
    .filter((record) => {
      const id = projectIdentity(record.applicationId);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .sort(
      (a, b) =>
        (b.proposedDwellings ?? -1) - (a.proposedDwellings ?? -1) ||
        a.applicationId.localeCompare(b.applicationId)
    )
    .slice(0, limit)
    .map((record) => projectIdentity(record.applicationId)!);
}

function sameEvidence(a: ProjectObservation, b: ProjectObservation): boolean {
  return (
    a.sourceUpdatedAt === b.sourceUpdatedAt &&
    a.status === b.status &&
    a.determinedOn === b.determinedOn &&
    a.proposedDwellings === b.proposedDwellings
  );
}

function milestone(
  stage: FollowThroughStage,
  label: string,
  basis: MilestoneBasis,
  on: string | null,
  detail: string
): ProjectMilestone {
  return { stage, label, basis, on, detail };
}

function buildMilestones(
  record: NswPlanningRecord,
  observations: ProjectObservation[]
): ProjectMilestone[] {
  const latest = observations[observations.length - 1]!;
  const determination = observations.find((observation) => observation.determinedOn !== null);
  const assessment = observations.find((observation) =>
    ASSESSMENT_STATUSES.has(observation.status)
  );
  const closed = CLOSED_STATUSES.has(latest.status);

  const milestones: ProjectMilestone[] = [
    milestone(
      "proposal",
      "Announced before lodgement",
      "not-evidenced",
      null,
      "This feed starts at lodgement. An earlier announcement is not evidenced here."
    ),
    milestone(
      "application",
      "Application lodged",
      "confirmed-event",
      record.lodgedOn,
      "The source publishes the lodgement date for this application."
    ),
  ];

  milestones.push(
    assessment
      ? milestone(
          "assessment",
          "With the consent authority",
          "source-state",
          assessment.sourceUpdatedAt,
          `Status "${assessment.status}" when the record was last changed. The source dates the change, not the decision behind it.`
        )
      : milestone(
          "assessment",
          "With the consent authority",
          "not-evidenced",
          null,
          "No read has returned an assessment status for this application."
        )
  );

  if (determination)
    milestones.push(
      milestone(
        "determination",
        "Determination recorded",
        "confirmed-event",
        determination.determinedOn!,
        "The source publishes a determination date. It does not publish whether the determination approved or refused the application, so this is not an approval."
      )
    );
  else if (closed)
    milestones.push(
      milestone(
        "determination",
        latest.status === "Rejected" ? "Recorded as rejected" : "Recorded as withdrawn",
        "source-state",
        latest.sourceUpdatedAt,
        `Status "${latest.status}" when the record was last changed. No determination date is published.`
      )
    );
  else
    milestones.push(
      milestone(
        "determination",
        "Determination recorded",
        "not-evidenced",
        null,
        "No determination date has appeared in any read of this application."
      )
    );

  milestones.push(
    milestone(
      "construction",
      "Construction started",
      "not-evidenced",
      null,
      "No connected source reports construction starts for an individual application."
    ),
    milestone(
      "completion",
      "Homes completed",
      "not-evidenced",
      null,
      "No connected source reports completions for an individual application."
    )
  );

  return milestones.sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));
}

/**
 * Build one project's dated timeline from the retained vintages.
 *
 * Returns null when the application never appears, so a missing project is a
 * missing page rather than an empty timeline that reads like a stalled project.
 */
export function buildProjectFollowThrough(
  projectId: string,
  vintages: PlanningVintage[]
): ProjectFollowThrough | null {
  const applicationId = projectApplicationId(projectId);
  if (!applicationId) return null;

  const dated = vintages
    .filter((vintage) => Number.isFinite(Date.parse(vintage.retrievedAt)))
    .slice()
    .sort((a, b) => Date.parse(a.retrievedAt) - Date.parse(b.retrievedAt));

  const observations: ProjectObservation[] = [];
  let record: NswPlanningRecord | null = null;
  let repeatChecks = 0;
  let lastCheckedAt: string | null = null;

  for (const vintage of dated) {
    const match = vintage.records.find((row) => row.applicationId === applicationId);
    if (!match) continue;
    record = match;
    lastCheckedAt = vintage.retrievedAt;
    const observation: ProjectObservation = {
      observedAt: vintage.retrievedAt,
      sourceUpdatedAt: match.sourceUpdatedAt,
      status: match.status,
      determinedOn: match.determinedOn,
      proposedDwellings: match.proposedDwellings,
    };
    const previous = observations[observations.length - 1];
    if (previous && sameEvidence(previous, observation)) {
      repeatChecks += 1;
      continue;
    }
    observations.push(observation);
  }

  if (!record || !lastCheckedAt || observations.length === 0) return null;

  const changes: ProjectChange[] = [];
  for (let index = 1; index < observations.length; index++) {
    const previous = observations[index - 1]!;
    const current = observations[index]!;
    const stamps = { sourceUpdatedAt: current.sourceUpdatedAt, observedAt: current.observedAt };
    if (previous.status !== current.status)
      changes.push({ kind: "status", from: previous.status, to: current.status, ...stamps });
    if (previous.determinedOn !== current.determinedOn && current.determinedOn)
      changes.push({ kind: "determination", on: current.determinedOn, ...stamps });
    if (previous.proposedDwellings !== current.proposedDwellings)
      changes.push({
        kind: "dwellings",
        from: previous.proposedDwellings,
        to: current.proposedDwellings,
        ...stamps,
      });
  }

  // One entry per distinct reported count, in the order the source changed it.
  // These are revisions of a single figure, never separate dwelling totals.
  const dwellingHistory: { value: number | null; sourceUpdatedAt: string }[] = [];
  for (const observation of observations) {
    const previous = dwellingHistory[dwellingHistory.length - 1];
    if (previous && previous.value === observation.proposedDwellings) continue;
    dwellingHistory.push({
      value: observation.proposedDwellings,
      sourceUpdatedAt: observation.sourceUpdatedAt,
    });
  }

  const latest = observations[observations.length - 1]!;
  return {
    projectId,
    applicationId,
    councilName: record.councilName,
    applicationType: record.applicationType,
    lodgedOn: record.lodgedOn,
    observations,
    repeatChecks,
    changes,
    milestones: buildMilestones(record, observations),
    dwellingHistory,
    reportedDwellings: latest.proposedDwellings,
    latestSourceUpdatedAt: latest.sourceUpdatedAt,
    lastCheckedAt,
    noNewerEvidenceSince: lastCheckedAt === latest.observedAt ? null : latest.observedAt,
    source: {
      dataset: NSW_PLANNING_DATASET,
      attribution: NSW_PLANNING_ATTRIBUTION,
      licence: FOLLOW_THROUGH_LICENCE,
    },
  };
}

/** Plain-language freshness, honest about what a repeat check does and does not prove. */
export function followThroughFreshness(project: ProjectFollowThrough): string {
  if (!project.noNewerEvidenceSince)
    return `Evidence last changed on the check of ${project.lastCheckedAt.slice(0, 10)}.`;
  return `No newer evidence found since ${project.noNewerEvidenceSince.slice(0, 10)}; last checked ${project.lastCheckedAt.slice(0, 10)}. An unchanged record is not a report that nothing has happened.`;
}

export type FollowThroughUpdate = {
  projectId: string;
  applicationId: string;
  councilName: string;
  change: ProjectChange;
  summary: string;
};

function changeSummary(project: ProjectFollowThrough, change: ProjectChange): string {
  if (change.kind === "status")
    return `${project.applicationId} (${project.councilName}) moved from "${change.from}" to "${change.to}".`;
  if (change.kind === "determination")
    return `${project.applicationId} (${project.councilName}) now carries a determination date of ${change.on}. The source does not publish the determination outcome.`;
  const from = change.from === null ? "not reported" : `${change.from}`;
  const to = change.to === null ? "not reported" : `${change.to}`;
  return `${project.applicationId} (${project.councilName}) revised its reported new dwellings from ${from} to ${to}. This replaces the earlier figure.`;
}

/**
 * Material changes for the editorial pipeline, newest first.
 *
 * "Material" is deliberately narrow: a status move, a determination date
 * appearing, or a revised dwelling count. A repeat check that found the same
 * evidence produces nothing, so an unchanged cohort creates no editorial noise.
 */
export function followThroughUpdates(
  projects: ProjectFollowThrough[],
  since?: string
): FollowThroughUpdate[] {
  const floor = since && Number.isFinite(Date.parse(since)) ? Date.parse(since) : null;
  return projects
    .flatMap((project) =>
      project.changes.map((change) => ({
        projectId: project.projectId,
        applicationId: project.applicationId,
        councilName: project.councilName,
        change,
        summary: changeSummary(project, change),
      }))
    )
    .filter((update) => floor === null || Date.parse(update.change.observedAt) > floor)
    .sort((a, b) => Date.parse(b.change.observedAt) - Date.parse(a.change.observedAt));
}

/**
 * The months the cohort re-read keeps alive: the three complete months before
 * the month the Signals pilot already reads on demand. Fixed and bounded, so
 * the source sees three extra reads a week for one council rather than an
 * open-ended crawl, and a cohort keeps being followed after its month rolls
 * out of the pilot window.
 */
export function followThroughPeriods(now: Date, months = 3): string[] {
  if (!Number.isFinite(now.getTime()) || !Number.isInteger(months) || months < 1) return [];
  const pilot = nswPlanningWindow(now).from;
  const [year, month] = pilot.split("-").map(Number);
  return Array.from({ length: months }, (_, index) =>
    new Date(Date.UTC(year!, month! - 2 - index, 1)).toISOString().slice(0, 7)
  );
}
