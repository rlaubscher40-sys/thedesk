import { describe, expect, it } from "vitest";
import { askQueryTerms, rankAskRecords } from "./relevance";

type Record = { title: string; body: string; date?: string };
const fields = { title: (row: Record) => row.title, body: (row: Record) => row.body, date: (row: Record) => row.date };

describe("Ask combined evidence ranking", () => {
  it("rescues a full-topic match from behind a capped list of single-word matches", () => {
    const noise = Array.from({ length: 12 }, (_, i) => ({ title: `Investor stock update ${i}`, body: "Technology earnings", date: "2026-09-08" }));
    const relevant = { title: "Investor lending update", body: "Housing loans", date: "2026-09-01" };
    expect(rankAskRecords("What is changing in investor lending?", [...noise, relevant], fields, 10)[0]).toBe(relevant);
  });

  it("uses publication date to prefer newer reports with equal relevance", () => {
    const older = { title: "Investor lending update", body: "Housing loans", date: "2026-06-01" };
    const newer = { ...older, date: "2026-09-01" };
    expect(rankAskRecords("investor lending", [older, newer], fields, 1)).toEqual([newer]);
  });

  it("preserves relevant historical reporting instead of always selecting the newest item", () => {
    const historical = { title: "Townsville housing in 2021", body: "Supply analysis", date: "2021-12-01" };
    const recent = { title: "Townsville housing", body: "Supply analysis", date: "2026-09-01" };
    expect(rankAskRecords("Townsville housing in 2021", [recent, historical], fields, 1)).toEqual([historical]);
  });

  it("does not match rate inside corporate or rent inside current", () => {
    const unrelated = { title: "Current corporate news", body: "Company technology update" };
    expect(rankAskRecords("rent rate", [unrelated], fields, 10)).toEqual([]);
  });

  it("keeps plural matches and meaningful locality abbreviations", () => {
    const relevant = { title: "WA investors seek housing loans", body: "Local lending" };
    expect(rankAskRecords("WA investor loans", [relevant], fields, 1)).toEqual([relevant]);
    expect(askQueryTerms("What does The Desk know about WA property?")).toEqual(["wa"]);
  });

  it("ignores conversational filler while retaining broad property questions", () => {
    expect(askQueryTerms("What is currently happening in investor lending?")).toEqual(["investor", "lending"]);
    expect(askQueryTerms("What is changing in the property market?")).toEqual(["property", "market"]);
  });
});
