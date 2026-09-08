import { afterEach, describe, expect, it, vi } from "vitest";
import { readAskHistory, rememberAskQuestion } from "./askHistory";

afterEach(() => vi.unstubAllGlobals());

describe("Ask history is optional", () => {
  it("keeps the new question when browser storage access is blocked", () => {
    vi.stubGlobal("window", { get localStorage() { throw new Error("SecurityError"); } });
    expect(readAskHistory()).toEqual([]);
    expect(rememberAskQuestion("Investor lending", ["Townsville supply"])).toEqual([
      "Investor lending", "Townsville supply",
    ]);
  });

  it("keeps recent questions in memory when the storage quota is full", () => {
    vi.stubGlobal("window", { localStorage: {
      getItem: () => '["Townsville supply"]',
      setItem: () => { throw new Error("QuotaExceededError"); },
    } });
    const first = rememberAskQuestion("Investor lending");
    expect(rememberAskQuestion("Housing approvals", first)).toEqual([
      "Housing approvals", "Investor lending", "Townsville supply",
    ]);
  });

  it("recovers from corrupt or unexpected saved history", () => {
    const getItem = vi.fn().mockReturnValue("invalid json");
    vi.stubGlobal("window", { localStorage: { getItem, setItem: vi.fn() } });
    expect(readAskHistory()).toEqual([]);
    getItem.mockReturnValue('{"unexpected":"object"}');
    expect(readAskHistory()).toEqual([]);
    getItem.mockReturnValue('[null,3," ","ab"," Townsville ","Townsville"]');
    expect(readAskHistory()).toEqual(["Townsville"]);
  });

  it("moves a repeated question to the top and persists at most five valid questions", () => {
    const setItem = vi.fn();
    vi.stubGlobal("window", { localStorage: { getItem: () => "[]", setItem } });
    const next = rememberAskQuestion("third question", [
      "first question", "second question", "third question", "fourth question", "fifth question", "sixth question",
    ]);
    expect(next).toEqual(["third question", "first question", "second question", "fourth question", "fifth question"]);
    expect(setItem).toHaveBeenCalledWith("thedesk:ask-history", JSON.stringify(next));
  });

  it("bounds restored questions to the API's input length", () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => JSON.stringify(["x".repeat(500)]), setItem: vi.fn() } });
    expect(readAskHistory()[0]).toHaveLength(240);
  });
});
