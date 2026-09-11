import { describe, it, expect } from "vitest";
import { verifiedNewLoanRates, verifiedInterstateMigration } from "./verifiedContextReels";
import { contextNow as now, testLoanRates, testMigration } from "./fixtures/contextReels";
import { assertProductionCandidate } from "../video/reelProduction";
import { rentPhrasePlan } from "../video/rentComparisonLayout";
import { validateEvidenceVisual } from "../video/evidenceVisual";

describe("new verified evidence families", () => {
  it("binds real units, periods and explanations to separate permanent publication identities", () => {
    const loans = verifiedNewLoanRates(testLoanRates(), now)!;
    const migration = verifiedInterstateMigration(testMigration(), now)!;
    for (const candidate of [loans, migration]) {
      expect(candidate).not.toBeNull();
      expect(() => assertProductionCandidate(candidate)).not.toThrow();
      expect(candidate.caption).not.toContain("\u2014");
      expect(candidate.caption.length).toBeLessThanOrEqual(1400);
      expect(
        rentPhrasePlan(candidate.stat.visualStory!).every((p) => p.phrases.join(" ") === p.text)
      ).toBe(true);
    }
    expect(loans.publication).toEqual({
      key: "instagram-reel-rba-new-loan-rates-v1",
      date: "2026-07-01",
    });
    expect(loans.caption).toContain("not a like-for-like price premium");
    expect(loans.stat.visualStory!.rows.map((r) => r.value)).toEqual([6.24, 6.41]);
    expect(migration.publication.date).toBe("2025-12-01");
    expect(migration.stat.visualStory!.rows.map((r) => r.value)).toEqual([16000, 10000]);
    expect(migration.caption).toContain("not Brisbane or Perth figures");
    expect(migration.caption).toContain("not a price forecast");
  });
  it.each(["missing", "duplicate", "period", "publication", "stale", "future", "nan", "negative"])(
    "withholds invalid loan evidence: %s",
    (kind) => {
      const r = testLoanRates();
      if (kind === "missing") r.pop();
      if (kind === "duplicate") r[1] = { ...r[0]! };
      if (kind === "period") r[1]!.period = new Date("2026-06-30");
      if (kind === "publication") r[1]!.publicationDate = new Date("2026-09-06");
      if (kind === "stale") r.forEach((x) => (x.period = new Date("2026-01-31")));
      if (kind === "future") r.forEach((x) => (x.publicationDate = new Date("2026-09-12")));
      if (kind === "nan") r[0]!.rate = NaN;
      if (kind === "negative") r[0]!.rate = -1;
      expect(verifiedNewLoanRates(r, now)).toBeNull();
    }
  );
  it.each(["missing", "duplicate", "status", "nan", "fraction", "retrieval", "future", "stale"])(
    "withholds invalid migration evidence: %s",
    (kind) => {
      const d = testMigration();
      const ix = d.observations.findIndex((r) => r.measure === "netInternalMigration");
      if (kind === "missing") d.observations.splice(ix, 1);
      if (kind === "duplicate") d.observations.push({ ...d.observations[ix]! });
      if (kind === "status") d.observations[ix]!.status = "unknown";
      if (kind === "nan") d.observations[ix]!.people = NaN;
      if (kind === "fraction") d.observations[ix]!.people = 1.5;
      if (kind === "retrieval") d.retrievedAt = "2026-09-01";
      if (kind === "future") d.retrievedAt = "2026-10-01";
      if (kind === "stale")
        d.observations.forEach(
          (r) => (r.period = r.period.replace("2025", "2023").replace("2024", "2022"))
        );
      expect(verifiedInterstateMigration(d, now)).toBeNull();
    }
  );
  it("accepts a retrieval completed after the programme clock but rejects future source quarters", () => {
    const d = testMigration();
    d.retrievedAt = new Date(now.getTime() + 10_000).toISOString();
    expect(verifiedInterstateMigration(d, now)).not.toBeNull();
    d.observations.forEach((r) => (r.period = r.period.replace("2025-Q4", "2026-Q3")));
    expect(verifiedInterstateMigration(d, now)).toBeNull();
  });
  it("preserves signs, zero, revision flags and locks across revisions and rechecks", () => {
    const d = testMigration();
    d.observations
      .filter((r) => r.measure === "netInternalMigration")
      .forEach((r) => {
        r.people = r.state === "Queensland" ? -1000 : 0;
        r.status = "r";
      });
    const first = verifiedInterstateMigration(d, now)!;
    expect(first.script[1]!.text).toContain("a net loss of 4,000");
    expect(first.script[1]!.text).toContain("no net change");
    expect(first.caption).toContain("Includes revised observations");
    d.observations.find((r) => r.measure === "netInternalMigration")!.people = -1001;
    const revised = verifiedInterstateMigration(d, new Date(now.getTime() + 3600000))!;
    expect(revised.publication).toEqual(first.publication);
    expect(revised.evidenceHash).not.toEqual(first.evidenceHash);
    const loans = testLoanRates();
    const publication = verifiedNewLoanRates(loans, now)!.publication;
    loans[0]!.rate = 6.25;
    expect(verifiedNewLoanRates(loans, now)!.publication).toEqual(publication);
    const visual = structuredClone(first.stat.visualStory!);
    visual.rows[0]!.value = 999;
    expect(() => validateEvidenceVisual(visual, first.script)).toThrow();
  });
});

it("creates a new episode only when the source reference period advances", () => {
  const rates = testLoanRates();
  const before = verifiedNewLoanRates(rates, now)!;
  rates.forEach((r) => (r.period = new Date("2026-08-31")));
  const after = verifiedNewLoanRates(rates, now)!;
  expect(after.publication.key).toBe(before.publication.key);
  expect(after.publication.date).toBe("2026-08-01");
  const data = testMigration();
  const previous = verifiedInterstateMigration(data, now)!;
  data.observations.forEach((r) => {
    const [y, q] = r.period.split("-Q").map(Number);
    r.period = q === 4 ? String(y! + 1) + "-Q1" : String(y) + "-Q" + String(q! + 1);
  });
  const next = verifiedInterstateMigration(data, now)!;
  expect(next.publication.key).toBe(previous.publication.key);
  expect(next.publication.date).toBe("2026-03-01");
});
