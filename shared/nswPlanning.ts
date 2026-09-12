export const NSW_PLANNING_DATASET =
  "https://www.planningportal.nsw.gov.au/opendata/dataset/online-da-data-api";
export const NSW_PLANNING_API = "https://api.apps1.nsw.gov.au/eplanning/data/v0/OnlineDA";
export const NSW_PLANNING_ATTRIBUTION =
  "© State Government of NSW and NSW Department of Planning, Housing and Infrastructure 2021";
export const NSW_PILOT_COUNCIL = "Council of the City of Sydney";
export const NSW_PLANNING_STATUSES = [
  "Additional Information Requested",
  "Determined",
  "Pending lodgement",
  "Rejected",
  "Pending Court Appeal",
  "Under Assessment",
  "Withdrawn",
  "Deferred Commencement",
  "On Exhibition",
] as const;
type NswPlanningStatus = (typeof NSW_PLANNING_STATUSES)[number];
export type NswPlanningRecord = {
  applicationId: string;
  applicationType:
    | "Development Application"
    | "Modification Application"
    | "Review of determination";
  status: NswPlanningStatus;
  councilName: string;
  lodgedOn: string;
  determinedOn: string | null;
  sourceUpdatedAt: string;
  proposedDwellings: number | null;
};
export type NswPlanningSnapshot = {
  councilName: string;
  geographyKind: "local-government-area";
  from: string;
  to: string;
  retrievedAt: string;
  fingerprint: string;
  applications: number;
  originalApplications: number;
  modifications: number;
  reviews: number;
  recordsWithDeterminationDate: number;
  statusCounts: Partial<Record<NswPlanningStatus, number>>;
  dwellings: { reported: number | null; reportedApplications: number; missingApplications: number };
  sourceUpdatedRange: { earliest: string; latest: string } | null;
  completePagination: true;
};
export type NswPlanningRead = {
  status: "available" | "unavailable";
  snapshot: NswPlanningSnapshot | null;
  previous: NswPlanningSnapshot[];
};
/** Historical reads are bounded to one complete calendar month, never an API date range. */
export function planningPeriodWindow(period: string): { from: string; to: string } | null {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)) return null;
  const [year, month] = period.split("-").map(Number);
  return { from: `${period}-01`, to: new Date(Date.UTC(year!, month!, 0)).toISOString().slice(0, 10) };
}
export function planningEvidenceHref(snapshot: NswPlanningSnapshot): string {
  return `/signals?planningPeriod=${encodeURIComponent(snapshot.from.slice(0, 7))}&planningRevision=${encodeURIComponent(snapshot.fingerprint)}#nsw-planning`;
}
/** Use the previous complete calendar month in Sydney, including at UTC month boundaries. */
export function nswPlanningWindow(now: Date): { from: string; to: string } {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")!.value);
  const month = Number(parts.find((p) => p.type === "month")!.value);
  return {
    from: new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 10),
    to: new Date(Date.UTC(year, month - 1, 0)).toISOString().slice(0, 10),
  };
}
