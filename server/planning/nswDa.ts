import { createHash } from "node:crypto";
import { z } from "zod";
import {
  NSW_PLANNING_API,
  NSW_PLANNING_STATUSES,
  type NswPlanningRecord,
  type NswPlanningSnapshot,
} from "../../shared/nswPlanning";

const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const MAX_PAGE_BYTES = 1_000_000;
const date = z.string().date();
const updated = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?$/)
  .refine(
    (v) =>
      date.safeParse(v.slice(0, 10)).success &&
      Number(v.slice(11, 13)) < 24 &&
      Number(v.slice(14, 16)) < 60 &&
      Number(v.slice(17, 19)) < 60
  );
/** Live v0 wire contract, verified against the department's supplied Postman collection.
 * This is separate from the older flat, DD/MM/YYYY dictionary export validator.
 * Only explicit wire fields are consumed; missing dwellings stay missing. */
const recordSchema = z
  .object({
    PlanningPortalApplicationNumber: z
      .string()
      .regex(/^PAN-\d+$/)
      .max(100),
    ApplicationType: z.enum([
      "Development Application",
      "Modification Application",
      "Review of determination",
    ]),
    ApplicationStatus: z.enum(NSW_PLANNING_STATUSES),
    Council: z.object({ CouncilName: z.string().trim().min(2).max(100) }),
    LodgementDate: date,
    DeterminationDate: date.nullish(),
    DateLastUpdated: updated,
    NumberOfNewDwellings: z.number().int().nonnegative().safe().nullish(),
  })
  .superRefine((row, ctx) => {
    if (row.ApplicationStatus === "Determined" && !row.DeterminationDate)
      ctx.addIssue({
        code: "custom",
        path: ["DeterminationDate"],
        message: "Determined record is missing its date",
      });
  });
const pageSchema = z.object({
  PageSize: z.literal(PAGE_SIZE),
  PageNumber: z.number().int().positive(),
  TotalPages: z.number().int().min(0).max(MAX_PAGES),
  TotalCount: z
    .number()
    .int()
    .min(0)
    .max(MAX_PAGES * PAGE_SIZE),
  Application: z.array(z.unknown()).max(PAGE_SIZE),
});
export function parseLiveNswDaRecord(input: unknown): NswPlanningRecord {
  const row = recordSchema.parse(input);
  return {
    applicationId: row.PlanningPortalApplicationNumber,
    applicationType: row.ApplicationType,
    status: row.ApplicationStatus,
    councilName: row.Council.CouncilName,
    lodgedOn: row.LodgementDate,
    determinedOn: row.DeterminationDate ?? null,
    sourceUpdatedAt: row.DateLastUpdated,
    proposedDwellings: row.NumberOfNewDwellings ?? null,
  };
}
async function readPage(response: Response): Promise<unknown> {
  if (
    !response.ok ||
    !/^application\/json(?:;|$)/i.test(response.headers.get("content-type") ?? "") ||
    Number(response.headers.get("content-length")) > MAX_PAGE_BYTES
  )
    throw new Error("NSW planning response unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty NSW planning response");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PAGE_BYTES) throw new Error("Oversized NSW planning response");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function fetchNswPlanningSnapshot(
  options: { councilName: string; from: string; to: string },
  dependencies: { fetcher?: typeof fetch; now?: Date } = {}
): Promise<{ snapshot: NswPlanningSnapshot; records: NswPlanningRecord[] }> {
  const councilName = z.string().trim().min(2).max(100).parse(options.councilName);
  const from = date.parse(options.from),
    to = date.parse(options.to);
  if (from > to || from < "2021-07-01") throw new Error("Unsupported NSW planning period");
  const records: NswPlanningRecord[] = [];
  const ids = new Set<string>();
  let pages = 1,
    count: number | null = null;
  const signal = AbortSignal.timeout(20_000);
  for (let pageNumber = 1; pageNumber <= pages; pageNumber++) {
    const response = await (dependencies.fetcher ?? fetch)(NSW_PLANNING_API, {
      headers: {
        Accept: "application/json",
        PageSize: String(PAGE_SIZE),
        PageNumber: String(pageNumber),
        filters: JSON.stringify({
          filters: { CouncilName: [councilName], LodgementDateFrom: from, LodgementDateTo: to },
        }),
      },
      signal,
      redirect: "error",
    });
    const page = pageSchema.parse(await readPage(response));
    const expectedPages = Math.max(1, Math.ceil(page.TotalCount / PAGE_SIZE));
    if (
      page.PageNumber !== pageNumber ||
      (page.TotalPages !== expectedPages && !(page.TotalCount === 0 && page.TotalPages === 0)) ||
      (count !== null && (page.TotalCount !== count || expectedPages !== pages)) ||
      page.Application.length !==
        Math.min(PAGE_SIZE, page.TotalCount - (pageNumber - 1) * PAGE_SIZE)
    )
      throw new Error("Incomplete or changing NSW planning pagination");
    count = page.TotalCount;
    pages = expectedPages;
    for (const input of page.Application) {
      const row = parseLiveNswDaRecord(input);
      if (row.councilName !== councilName || row.lodgedOn < from || row.lodgedOn > to)
        throw new Error("NSW planning response crossed the requested geography or period");
      if (ids.has(row.applicationId))
        throw new Error("Duplicate NSW planning application identity");
      ids.add(row.applicationId);
      records.push(row);
    }
  }
  if (records.length !== count) throw new Error("Incomplete NSW planning snapshot");
  records.sort((a, b) => a.applicationId.localeCompare(b.applicationId));
  const originals = records.filter((r) => r.applicationType === "Development Application");
  const reported = originals.filter((r) => r.proposedDwellings !== null);
  const dwellingSum = reported.reduce((n, r) => n + r.proposedDwellings!, 0);
  if (!Number.isSafeInteger(dwellingSum)) throw new Error("Unsafe NSW planning dwelling total");
  const statusCounts: NswPlanningSnapshot["statusCounts"] = {};
  for (const row of records) statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
  const updates = records.map((r) => r.sourceUpdatedAt).sort();
  return {
    records,
    snapshot: {
      councilName,
      geographyKind: "local-government-area",
      from,
      to,
      retrievedAt: (dependencies.now ?? new Date()).toISOString(),
      fingerprint: createHash("sha256").update(JSON.stringify(records)).digest("hex"),
      applications: records.length,
      originalApplications: originals.length,
      modifications: records.filter((r) => r.applicationType === "Modification Application").length,
      reviews: records.filter((r) => r.applicationType === "Review of determination").length,
      recordsWithDeterminationDate: records.filter((r) => r.determinedOn !== null).length,
      statusCounts,
      dwellings: {
        reported: reported.length ? dwellingSum : null,
        reportedApplications: reported.length,
        missingApplications: originals.length - reported.length,
      },
      sourceUpdatedRange: updates.length
        ? { earliest: updates[0]!, latest: updates.at(-1)! }
        : null,
      completePagination: true,
    },
  };
}
