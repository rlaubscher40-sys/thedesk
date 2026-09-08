import { describe, expect, it } from "vitest";
import { parseNswDaRecord, parseNswDaRecords, summariseNswDaPilot } from "./nswDa";

const rawRecord = {
  PlanningPortalApplicationNumber: "PAN-12345",
  ApplicationType: "Development application",
  ApplicationStatus: "Determined",
  FullAddress: "10 Example Street, Sydney NSW 2000",
  CouncilName: "Council of the City of Sydney",
  DevelopmentType: ["Residential flat building", "Demolition"],
  NumberOfNewDwellings: 42,
  LodgementDate: "07/08/2026",
  DeterminationAuthority: "Local Planning Panel",
  DeterminationDate: "01/09/2026",
  CostofDevelopment: 12_500_000,
  Postcode: "2000",
};

describe("NSW Online DA pilot contract", () => {
  it("preserves official identity, geography, status, dates and dwelling meaning", () => {
    expect(parseNswDaRecord(rawRecord)).toEqual({
      applicationId: "PAN-12345",
      applicationType: "Development application",
      status: "Determined",
      address: "10 Example Street, Sydney NSW 2000",
      councilName: "Council of the City of Sydney",
      developmentTypes: ["Residential flat building", "Demolition"],
      proposedNewDwellings: 42,
      lodgedOn: "2026-08-07",
      determinationAuthority: "Local Planning Panel",
      determinedOn: "2026-09-01",
      estimatedDevelopmentCost: 12_500_000,
    });
  });

  it("fails closed on aliases, unknown statuses, impossible dates and missing determinations", () => {
    expect(() =>
      parseNswDaRecord({ ...rawRecord, PlanningPortalApplicationNumber: undefined, id: "PAN-1" })
    ).toThrow();
    expect(() => parseNswDaRecord({ ...rawRecord, ApplicationStatus: "Approved" })).toThrow();
    expect(() => parseNswDaRecord({ ...rawRecord, LodgementDate: "31/02/2026" })).toThrow();
    expect(() => parseNswDaRecord({ ...rawRecord, DeterminationDate: "" })).toThrow(
      /determination date/i
    );
  });

  it("rejects duplicate application identities instead of double-counting them", () => {
    expect(() => parseNswDaRecords([rawRecord, rawRecord])).toThrow(/Duplicate NSW DA/u);
  });

  it("does not count modifications as fresh dwelling proposals or determinations as approvals", () => {
    const modification = {
      ...rawRecord,
      PlanningPortalApplicationNumber: "PAN-54321",
      ApplicationType: "Modification application",
      ApplicationStatus: "Under Assessment",
      NumberOfNewDwellings: 99,
      LodgementDate: "08/08/2026",
      DeterminationAuthority: "",
      DeterminationDate: "",
    };
    const snapshot = summariseNswDaPilot(parseNswDaRecords([rawRecord, modification]), {
      councilName: "Council of the City of Sydney",
      from: "2026-08-01",
      to: "2026-08-31",
      retrievedAt: "2026-09-08T03:30:00Z",
    });

    expect(snapshot.applicationRecords).toBe(2);
    expect(snapshot.originalDevelopmentApplications).toBe(1);
    expect(snapshot.proposedNewDwellings).toBe(42);
    expect(snapshot.recordsWithDeterminationDate).toBe(1);
    expect(snapshot.statusCounts).toEqual({ Determined: 1, "Under Assessment": 1 });
    expect(snapshot.geography).toEqual({
      kind: "local-government-area",
      name: "Council of the City of Sydney",
    });
    expect(snapshot.evidence.dwellingMeaning).toMatch(/not approvals.+completed homes/i);
    expect(snapshot.evidence.determinationMeaning).toMatch(/not identify.+approved or refused/i);
  });

  it("rejects rows outside the requested council or lodgement period", () => {
    const record = parseNswDaRecord(rawRecord);
    const options = {
      councilName: "Council of the City of Sydney",
      from: "2026-08-01",
      to: "2026-08-31",
      retrievedAt: "2026-09-08T03:30:00Z",
    };
    expect(() =>
      summariseNswDaPilot([{ ...record, councilName: "North Sydney Council" }], options)
    ).toThrow(/crossed geography/i);
    expect(() => summariseNswDaPilot([{ ...record, lodgedOn: "2026-09-01" }], options)).toThrow(
      /crossed lodgement window/i
    );
  });

  it("surfaces the official pre-mandate coverage warning", () => {
    const record = parseNswDaRecord({ ...rawRecord, LodgementDate: "30/06/2021" });
    const snapshot = summariseNswDaPilot([record], {
      councilName: record.councilName,
      from: "2021-06-01",
      to: "2021-06-30",
      retrievedAt: "2026-09-08T03:30:00Z",
    });
    expect(snapshot.coverage).toBe("pre-mandate-may-be-incomplete");
    expect(snapshot.evidence.coverageCaveat).toMatch(/may be missing/i);
  });
});
