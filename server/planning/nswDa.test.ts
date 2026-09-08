import { describe, expect, it, vi } from "vitest";
import fixture from "./nswDa.fixture.json";
import { fetchNswPlanningSnapshot, parseLiveNswDaRecord } from "./nswDa";
import { NSW_PILOT_COUNCIL, nswPlanningWindow } from "../../shared/nswPlanning";
const options = { councilName: NSW_PILOT_COUNCIL, from: "2026-08-01", to: "2026-08-31" };
const now = new Date("2026-09-08T07:30:00Z");
const page = (rows: unknown[], overrides: Record<string, unknown> = {}) => ({
  PageSize: 100,
  PageNumber: 1,
  TotalPages: 1,
  TotalCount: rows.length,
  Application: rows,
  ...overrides,
});
const response = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
const run = (payload: unknown) =>
  fetchNswPlanningSnapshot(options, { now, fetcher: vi.fn().mockResolvedValue(response(payload)) });

describe("NSW live wire contract", () => {
  it("reads real nested Council and ISO-date fields without guessing aliases", () => {
    const row = parseLiveNswDaRecord(fixture.records[0]);
    expect(row.applicationId).toBe(fixture.records[0]!.PlanningPortalApplicationNumber);
    expect(row.councilName).toBe(NSW_PILOT_COUNCIL);
    expect(row.proposedDwellings).toBeNull();
    expect(row.sourceUpdatedAt).toBe(fixture.records[0]!.DateLastUpdated);
    expect(row).not.toHaveProperty("address");
    expect(() =>
      parseLiveNswDaRecord({
        ...fixture.records[0],
        Council: undefined,
        CouncilName: NSW_PILOT_COUNCIL,
      })
    ).toThrow();
  });
  it("distinguishes absent, explicit zero and invalid dwelling values", () => {
    expect(
      parseLiveNswDaRecord({ ...fixture.records[0], NumberOfNewDwellings: 0 }).proposedDwellings
    ).toBe(0);
    for (const value of ["12", -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
      expect(() =>
        parseLiveNswDaRecord({ ...fixture.records[0], NumberOfNewDwellings: value })
      ).toThrow();
  });
  it("rejects unsupported statuses, impossible dates and undated determinations", () => {
    for (const patch of [
      { ApplicationStatus: "Approved" },
      { LodgementDate: "2026-02-30" },
      { DateLastUpdated: "2026-02-30T14:00:00" },
      { ApplicationStatus: "Determined", DeterminationDate: undefined },
    ])
      expect(() => parseLiveNswDaRecord({ ...fixture.records[0], ...patch })).toThrow();
  });
  it("counts original proposals only, with missing coverage explicit and addresses ignored", async () => {
    const raws = fixture.records.map((r, i) => ({
      ...r,
      NumberOfNewDwellings: i === 0 ? undefined : i === 1 ? 5 : 999,
      Location: [{ FullAddress: "one" }, { FullAddress: "two" }],
    }));
    const { snapshot, records } = await run(page(raws));
    expect(snapshot.applications).toBe(4);
    expect(snapshot.originalApplications).toBe(2);
    expect(snapshot.modifications).toBe(1);
    expect(snapshot.reviews).toBe(1);
    expect(snapshot.dwellings).toEqual({
      reported: 5,
      reportedApplications: 1,
      missingApplications: 1,
    });
    expect(records).toHaveLength(4);
    expect(JSON.stringify(records)).not.toContain("FullAddress");
  });
  it("does not invent zero dwellings when nothing is reported", async () => {
    expect((await run(page([fixture.records[0]]))).snapshot.dwellings.reported).toBeNull();
  });
  it("uses bounded, credential-free requests with the exact department filter headers", async () => {
    const fetcher = vi.fn().mockResolvedValue(response(page(fixture.records)));
    await fetchNswPlanningSnapshot(options, { now, fetcher });
    const [url, request] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://api.apps1.nsw.gov.au/eplanning/data/v0/OnlineDA");
    expect(request.headers).not.toHaveProperty("Authorization");
    expect(request.headers.PageSize).toBe("100");
    expect(JSON.parse(request.headers.filters)).toEqual({
      filters: {
        CouncilName: [NSW_PILOT_COUNCIL],
        LodgementDateFrom: options.from,
        LodgementDateTo: options.to,
      },
    });
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(request.redirect).toBe("error");
  });
  it("fetches all pages and checks total count before exposing a snapshot", async () => {
    const rows = Array.from({ length: 101 }, (_, i) => ({
      ...fixture.records[0],
      PlanningPortalApplicationNumber: `PAN-${i + 1}`,
    }));
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(page(rows.slice(0, 100), { TotalCount: 101, TotalPages: 2 })))
      .mockResolvedValueOnce(
        response(page(rows.slice(100), { PageNumber: 2, TotalCount: 101, TotalPages: 2 }))
      );
    const { snapshot } = await fetchNswPlanningSnapshot(options, { now, fetcher });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(snapshot.applications).toBe(101);
    expect(snapshot.completePagination).toBe(true);
  });
  it("rejects partial, repeated and changing page metadata", async () => {
    await expect(run(page(fixture.records, { TotalCount: 5 }))).rejects.toThrow();
    await expect(run(page(fixture.records, { PageNumber: 2 }))).rejects.toThrow();
    await expect(
      run(page(fixture.records, { TotalPages: 1000, TotalCount: 100000 }))
    ).rejects.toThrow();
    const rows = Array.from({ length: 100 }, (_, i) => ({
      ...fixture.records[0],
      PlanningPortalApplicationNumber: `PAN-${i + 1}`,
    }));
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(page(rows, { TotalCount: 101, TotalPages: 2 })))
      .mockResolvedValueOnce(
        response(page([fixture.records[1]], { PageNumber: 2, TotalCount: 102, TotalPages: 2 }))
      );
    await expect(fetchNswPlanningSnapshot(options, { now, fetcher })).rejects.toThrow(/pagination/);
  });
  it("rejects duplicate identities, crossed geography and crossed periods", async () => {
    await expect(run(page([fixture.records[0], fixture.records[0]]))).rejects.toThrow(/Duplicate/);
    await expect(
      run(page([{ ...fixture.records[0], Council: { CouncilName: "North Sydney Council" } }]))
    ).rejects.toThrow(/geography/);
    await expect(
      run(page([{ ...fixture.records[0], LodgementDate: "2026-09-01" }]))
    ).rejects.toThrow(/period/);
  });
  it("fails on non-JSON, source errors and oversized streamed bodies", async () => {
    for (const r of [
      new Response("down", { status: 503 }),
      new Response("<html>down</html>"),
      new Response(" ".repeat(1_000_001), { headers: { "content-type": "application/json" } }),
    ]) {
      await expect(
        fetchNswPlanningSnapshot(options, { now, fetcher: vi.fn().mockResolvedValue(r) })
      ).rejects.toThrow();
    }
  });
  it("handles a verified empty page and stable identity ordering", async () => {
    const { snapshot } = await run(page([], { TotalPages: 0 }));
    expect(snapshot.applications).toBe(0);
    expect(snapshot.dwellings.reported).toBeNull();
    const one = (await run(page(fixture.records))).snapshot;
    const two = (await run(page([...fixture.records].reverse()))).snapshot;
    expect(one.fingerprint).toBe(two.fingerprint);
  });
  it("uses the Sydney calendar at month and year boundaries", () => {
    expect(nswPlanningWindow(new Date("2026-08-31T15:00:00Z"))).toEqual({
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(nswPlanningWindow(new Date("2026-01-01T00:00:00Z"))).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });
});
