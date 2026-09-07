import { describe, expect, it } from "vitest";
import {
  buildScript,
  deshout,
  estimateSpeechSeconds,
  REEL_SIGN_OFF,
  speakValue,
} from "./narration";

describe("speakValue", () => {
  it("puts the currency where a person would say it", () => {
    expect(speakValue("$815,439")).toBe("815,439 dollars");
    expect(speakValue("$1.2m")).toBe("1.2 million dollars");
  });

  it("says per cent rather than leaving the symbol to be guessed at", () => {
    expect(speakValue("4.3%")).toBe("4.3 per cent");
  });

  it("expands the abbreviations a reader would never say aloud", () => {
    expect(speakValue("25bps")).toBe("25 basis points");
    expect(speakValue("1.4pp")).toBe("1.4 percentage points");
    expect(speakValue("12k")).toBe("12 thousand");
  });

  it("says a minus rather than trusting the model to see a dash", () => {
    expect(speakValue("-2.1%")).toBe("minus 2.1 per cent");
  });

  it("leaves a plain number alone", () => {
    expect(speakValue("12,480")).toBe("12,480");
  });
});

describe("deshout", () => {
  it("brings the card's uppercase down to something readable aloud", () => {
    expect(deshout("LOWEST SINCE MARCH 2023")).toBe("Lowest since march 2023");
  });

  it("keeps acronyms as acronyms", () => {
    // "ABS" read as the word "abs" is the tell of a machine reading a card.
    expect(deshout("HIGHEST SINCE 2022 · ABS")).toBe("Highest since 2022. ABS");
  });

  it("turns the card's separator into the pause a reader would take", () => {
    expect(deshout("A · B")).toBe("A. B");
  });

  it("leaves ordinary sentence-case prose untouched", () => {
    const line = "Unemployment held at 4.3 per cent in July.";
    expect(deshout(line)).toBe(line);
  });
});

describe("buildScript", () => {
  const stat = {
    label: "Unemployment rate",
    value: "4.3%",
    line: "Unemployment held at 4.3 per cent in July.",
    subtext: "LOWEST SINCE MARCH 2023 · ABS",
  };

  it("says only what the card already says", () => {
    // The whole factual-integrity contract: nothing is written for the audio,
    // so the voice cannot claim anything the checked figures do not.
    const spoken = buildScript(stat)
      .filter((l) => l.key !== "signOff")
      .map((l) => l.text)
      .join(" ");
    expect(spoken).toContain("Unemployment rate.");
    expect(spoken).toContain("4.3 per cent.");
    expect(spoken).toContain(stat.line);
    expect(spoken).toContain("Lowest since march 2023. ABS");
  });

  it("closes on the follow, because the next number is the product", () => {
    const script = buildScript(stat);
    expect(script[script.length - 1]!.text).toBe(REEL_SIGN_OFF);
  });

  it("skips a passage with nothing in it rather than speaking an empty string", () => {
    const keys = buildScript({ ...stat, line: "", subtext: "  " }).map((l) => l.key);
    expect(keys).toEqual(["label", "value", "signOff"]);
  });

  it("keys every passage, so the pictures can be cut to it", () => {
    const keys = buildScript(stat).map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("estimateSpeechSeconds", () => {
  it("paces a passage like a news read", () => {
    expect(estimateSpeechSeconds("Unemployment held at 4.3 per cent in July.")).toBeGreaterThan(2);
    expect(estimateSpeechSeconds("Unemployment held at 4.3 per cent in July.")).toBeLessThan(4.5);
  });

  it("is zero for nothing, so an empty passage does not hold the frame", () => {
    expect(estimateSpeechSeconds("   ")).toBe(0);
  });

  it("grows with the passage", () => {
    expect(estimateSpeechSeconds("one two three four")).toBeGreaterThan(
      estimateSpeechSeconds("one two")
    );
  });
});
