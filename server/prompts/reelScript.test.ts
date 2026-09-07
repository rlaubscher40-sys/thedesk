import { describe, expect, it } from "vitest";
import { allowedFacts, rejectScript, type ReelScriptLines } from "./reelScript";

const stat = {
  label: "National dwelling approvals",
  value: "12,480",
  line: "Approvals climbed for a fourth straight month, the longest run since 2021.",
  subtext: "HIGHEST SINCE MARCH 2022 · ABS",
  context: null,
  source: "ABS",
  direction: "up" as const,
};

const facts = [
  { figure: "+410", caption: "Up on the previous reading" },
  { figure: "8,495 — 13,250", caption: "Range across every reading we hold" },
  { figure: "10,715", caption: "Typical reading over the period" },
];

const allowed = allowedFacts(stat, facts);

function script(over: Partial<ReelScriptLines> = {}): ReelScriptLines {
  return {
    // Written to the caps, which doubles as a check that a passage that
    // actually explains something still fits inside them.
    open: "Approvals just did something they have not done in four years.",
    number: "Twelve thousand, four hundred and eighty.",
    meaning: "A fourth straight month of increases, the longest run since 2021.",
    context: "The highest reading since March 2022.",
    detail: "It sits above the typical reading of 10,715, near the top of its range.",
    ...over,
  };
}

describe("allowedFacts", () => {
  it("lets the script draw on everything printed on the card", () => {
    // The supporting figures are on screen; a viewer can read them, so the
    // voice may say them.
    expect(allowed.join(" ")).toContain("10,715");
    expect(allowed.join(" ")).toContain("8,495");
  });
});

describe("rejectScript", () => {
  it("passes a script whose every figure traces to a source fact", () => {
    expect(rejectScript(script(), allowed)).toBeNull();
  });

  it("rejects a figure that exists nowhere in the data", () => {
    // The single worst failure available to this format: a number the
    // publication cannot stand behind, said out loud.
    const reason = rejectScript(
      script({ detail: "Approvals are up 18 per cent on last year." }),
      allowed
    );
    expect(reason).toContain("detail");
    expect(reason).toContain("not in the source facts");
  });

  it("fails the whole script for one bad line, not just that line", () => {
    // A half-generated script mixes two registers and reads worse than the
    // plain one, so the fallback has to be all-or-nothing.
    expect(
      rejectScript(script({ open: "Approvals hit 99,999 this month." }), allowed)
    ).not.toBeNull();
  });

  it("rejects a passage too long to fit the beat it plays over", () => {
    // The beat holds a still frame for exactly as long as the voice runs, so
    // an overlong passage does not overflow, it drags.
    const reason = rejectScript(
      script({ number: "Twelve thousand, four hundred and eighty. ".repeat(4) }),
      allowed
    );
    expect(reason).toContain("number");
    expect(reason).toContain("over");
  });

  it("rejects a script with a passage missing rather than playing it silent", () => {
    expect(rejectScript(script({ context: "" }), allowed)).toContain("context is missing");
    expect(rejectScript({ ...script(), detail: undefined }, allowed)).toContain(
      "detail is missing"
    );
  });

  it("allows spelled-out numbers, which carry no digits to check", () => {
    // "a fourth straight month" is already carried by the computed claim.
    expect(
      rejectScript(script({ open: "Approvals have risen for a fourth straight month." }), allowed)
    ).toBeNull();
  });

  it("allows the headline figure spoken in words", () => {
    expect(
      rejectScript(script({ number: "Twelve thousand four hundred and eighty." }), allowed)
    ).toBeNull();
  });
});
