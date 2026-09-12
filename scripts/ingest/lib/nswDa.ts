import { z } from "zod";

const NSW_DA_DATASET_URL =
  "https://www.planningportal.nsw.gov.au/opendata/dataset/online-da-data-api";
const NSW_DA_DICTIONARY_URL =
  "https://www.planningportal.nsw.gov.au/opendata/dataset/88c61ad1-7096-45ae-b1ac-94963e4cfca1/resource/95279ab6-b115-4300-bb21-30461dae3985/download/online-da-api-v2.0.pdf";
const NSW_DA_PUBLISHER = "NSW Department of Planning, Housing and Infrastructure";
const NSW_DA_COUNCIL_MANDATE_START = "2021-07-01";

const applicationTypeSchema = z.enum([
  "Development application",
  "Modification application",
  "Review of determination",
]);

const applicationStatusSchema = z.enum([
  "Additional Information Requested",
  "Determined",
  "Pending lodgement",
  "Rejected",
  "Pending Court Appeal",
  "Under Assessment",
  "Withdrawn",
  "Deferred Commencement",
  "On Exhibition",
]);

const determinationAuthoritySchema = z.enum([
  "Council",
  "Sydney / Regional Planning Panel",
  "Local Planning Panel",
  "Central Sydney Planning Committee",
]);

function parseDictionaryDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/u.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  return `${year}-${month}-${day}`;
}

const dictionaryDateSchema = z.unknown().transform(parseDictionaryDate).pipe(z.string().date());

const optionalDictionaryDateSchema = z
  .unknown()
  .transform(parseDictionaryDate)
  .pipe(z.string().date().nullable());

/**
 * Fields consumed from the October 2025 Online DA API data dictionary.
 * Unknown fields are deliberately ignored so adding an official field does not
 * stop an import. Identity, geography, status and dwelling fields never fall
 * back to aliases: a rename of one of those fields fails closed.
 */
const rawNswDaRecordSchema = z
  .object({
    PlanningPortalApplicationNumber: z
      .string()
      .trim()
      .regex(/^PAN-[0-9]+$/u)
      .max(100),
    ApplicationType: applicationTypeSchema,
    ApplicationStatus: applicationStatusSchema,
    FullAddress: z.string().trim().min(1).max(200),
    CouncilName: z.string().trim().min(2).max(100),
    DevelopmentType: z.union([
      z.string().trim().min(1).max(100),
      z.array(z.string().trim().min(1).max(100)).min(1),
    ]),
    NumberOfNewDwellings: z.number().int().nonnegative(),
    LodgementDate: dictionaryDateSchema,
    DeterminationAuthority: z.union([determinationAuthoritySchema, z.literal(""), z.null()]),
    DeterminationDate: optionalDictionaryDateSchema,
    CostofDevelopment: z.number().nonnegative(),
  })
  .passthrough()
  .superRefine((record, ctx) => {
    if (record.ApplicationStatus === "Determined" && record.DeterminationDate === null) {
      ctx.addIssue({
        code: "custom",
        path: ["DeterminationDate"],
        message: "A determined application must carry its determination date.",
      });
    }
  });

type NswDaApplicationStatus = z.infer<typeof applicationStatusSchema>;

export type NswDaRecord = {
  applicationId: string;
  applicationType: z.infer<typeof applicationTypeSchema>;
  status: NswDaApplicationStatus;
  address: string;
  councilName: string;
  developmentTypes: string[];
  proposedNewDwellings: number;
  lodgedOn: string;
  determinationAuthority: z.infer<typeof determinationAuthoritySchema> | null;
  determinedOn: string | null;
  estimatedDevelopmentCost: number;
};

export function parseNswDaRecord(input: unknown): NswDaRecord {
  const parsed = rawNswDaRecordSchema.parse(input);
  return {
    applicationId: parsed.PlanningPortalApplicationNumber,
    applicationType: parsed.ApplicationType,
    status: parsed.ApplicationStatus,
    address: parsed.FullAddress,
    councilName: parsed.CouncilName,
    developmentTypes: Array.isArray(parsed.DevelopmentType)
      ? parsed.DevelopmentType
      : [parsed.DevelopmentType],
    proposedNewDwellings: parsed.NumberOfNewDwellings,
    lodgedOn: parsed.LodgementDate,
    determinationAuthority: parsed.DeterminationAuthority || null,
    determinedOn: parsed.DeterminationDate,
    estimatedDevelopmentCost: parsed.CostofDevelopment,
  };
}

export function parseNswDaRecords(input: unknown): NswDaRecord[] {
  const rows = z.array(z.unknown()).parse(input);
  const parsed = rows.map(parseNswDaRecord);
  const seen = new Set<string>();
  for (const record of parsed) {
    if (seen.has(record.applicationId)) {
      throw new Error(`Duplicate NSW DA application identity: ${record.applicationId}`);
    }
    seen.add(record.applicationId);
  }
  return parsed;
}

export type NswDaPilotSnapshot = {
  geography: { kind: "local-government-area"; name: string };
  period: { kind: "lodgement-date"; from: string; to: string };
  retrievedAt: string;
  applicationRecords: number;
  originalDevelopmentApplications: number;
  proposedNewDwellings: number;
  recordsWithDeterminationDate: number;
  statusCounts: Partial<Record<NswDaApplicationStatus, number>>;
  coverage: "pre-mandate-may-be-incomplete" | "post-mandate";
  evidence: {
    publisher: typeof NSW_DA_PUBLISHER;
    datasetUrl: typeof NSW_DA_DATASET_URL;
    dictionaryUrl: typeof NSW_DA_DICTIONARY_URL;
    licence: "Creative Commons Attribution 4.0";
    dwellingMeaning: string;
    determinationMeaning: string;
    coverageCaveat: string;
    revisionCaveat: string;
  };
};

const isoDateSchema = z.string().date();
const isoDateTimeSchema = z.string().datetime({ offset: true });

/**
 * Produce one council / lodgement-window snapshot. The result is intentionally
 * not a generic "approvals" metric: the public dictionary exposes application
 * status and a determination date, but not an approved/refused outcome.
 */
export function summariseNswDaPilot(
  records: NswDaRecord[],
  options: { councilName: string; from: string; to: string; retrievedAt: string }
): NswDaPilotSnapshot {
  const councilName = z.string().trim().min(2).max(100).parse(options.councilName);
  const from = isoDateSchema.parse(options.from);
  const to = isoDateSchema.parse(options.to);
  const retrievedAt = isoDateTimeSchema.parse(options.retrievedAt);
  if (from > to) throw new Error("NSW DA lodgement window starts after it ends.");

  const councilKey = councilName.toLocaleLowerCase("en-AU");
  const statusCounts: Partial<Record<NswDaApplicationStatus, number>> = {};
  let originalDevelopmentApplications = 0;
  let proposedNewDwellings = 0;
  let recordsWithDeterminationDate = 0;

  for (const record of records) {
    if (record.councilName.toLocaleLowerCase("en-AU") !== councilKey) {
      throw new Error(
        `NSW DA response crossed geography: expected ${councilName}, received ${record.councilName}.`
      );
    }
    if (record.lodgedOn < from || record.lodgedOn > to) {
      throw new Error(
        `NSW DA response crossed lodgement window: ${record.applicationId} was lodged ${record.lodgedOn}.`
      );
    }
    statusCounts[record.status] = (statusCounts[record.status] ?? 0) + 1;
    if (record.determinedOn) recordsWithDeterminationDate += 1;
    // Modifications and reviews refer back to an existing application. Adding
    // their dwelling fields would risk double-counting the proposal.
    if (record.applicationType === "Development application") {
      originalDevelopmentApplications += 1;
      proposedNewDwellings += record.proposedNewDwellings;
    }
  }

  const preMandate = from < NSW_DA_COUNCIL_MANDATE_START;
  return {
    geography: { kind: "local-government-area", name: councilName },
    period: { kind: "lodgement-date", from, to },
    retrievedAt,
    applicationRecords: records.length,
    originalDevelopmentApplications,
    proposedNewDwellings,
    recordsWithDeterminationDate,
    statusCounts,
    coverage: preMandate ? "pre-mandate-may-be-incomplete" : "post-mandate",
    evidence: {
      publisher: NSW_DA_PUBLISHER,
      datasetUrl: NSW_DA_DATASET_URL,
      dictionaryUrl: NSW_DA_DICTIONARY_URL,
      licence: "Creative Commons Attribution 4.0",
      dwellingMeaning:
        "Proposed new dwellings stated on original development applications lodged in the period; not approvals, construction starts or completed homes.",
      determinationMeaning:
        "A determination date shows that a record was determined; the public field contract does not identify the outcome as approved or refused.",
      coverageCaveat: preMandate
        ? "The official dataset warns that cases before mandatory council use of the NSW Planning Portal on 1 July 2021 may be missing."
        : "The window begins after mandatory council use of the NSW Planning Portal started on 1 July 2021.",
      revisionCaveat:
        "The source is updated daily and application statuses can change; this is a retrieved snapshot, not a frozen vintage.",
    },
  };
}
