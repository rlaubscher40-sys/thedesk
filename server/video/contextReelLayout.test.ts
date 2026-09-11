import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import {
  verifiedNewLoanRates,
  verifiedInterstateMigration,
} from "../instagram/verifiedContextReels";
import { testLoanRates, testMigration, contextNow } from "../instagram/fixtures/contextReels";
import { contextReelLayout, repaymentCueProgress } from "./contextReelLayout";
import { exampleRepayments, loanDollars } from "../../shared/loanRepaymentExample";
import { splitMotion } from "./reelMotion";
import { renderEditorialFrame, renderEditorialLayer } from "../og/instagramCards";
import { voiceModel } from "./localVoice";
import { renderStatReel } from "./statReel";
import { productionReelOptions } from "./reelProduction";

const candidate = (kind: string) =>
  kind === "loans"
    ? verifiedNewLoanRates(testLoanRates(), contextNow)!
    : verifiedInterstateMigration(testMigration(), contextNow)!;

describe("context stories preserve numerical meaning", () => {
  it("starts repayments at their measured phrase, then holds the first term on the same scale", () => {
    const phrases = [
      { text: "Assumptions.", start: 0, seconds: 3 },
      { text: "Thirty years.", start: 3.08, seconds: 3 },
    ];
    expect(repaymentCueProgress("claim", 3, phrases)).toEqual([0, 0]);
    expect(repaymentCueProgress("claim", 6, phrases)).toEqual([1, 0]);
    expect(() => repaymentCueProgress("claim", 1, phrases.slice(0, 1))).toThrow();
    const v = candidate("loans").stat.visualStory!;
    const render = (key: string, repayment: [number, number]) =>
      splitMotion(
        contextReelLayout(v, key, { progress: 1, rates: [1, 1], repayment }, "navy").content
      );
    const before = render("claim", [1, 0]);
    const after = render("facts", [1, 1]);
    expect(before.staticTree).toEqual(after.staticTree);
    for (const id of ["term-0", "repayment-0", "repayment-bar-0"])
      expect(before.layers.find((l) => l.id === id)).toEqual(after.layers.find((l) => l.id === id));
    expect(before.layers.find((l) => l.id === "repayment-1")!.opacity).toBe(0);
    const [long, short] = exampleRepayments();
    for (const p of [0, 0.1, 0.5, 1]) {
      const layers = render("facts", [1, p]).layers;
      expect(layers.find((l) => l.id === "repayment-bar-0")!.node.props.style.width).toBeCloseTo(
        (840 * long!.monthly) / short!.monthly
      );
      expect(layers.find((l) => l.id === "repayment-bar-1")!.node.props.style.width).toBeCloseTo(
        840 * p
      );
      expect(JSON.stringify(layers.find((l) => l.id === "repayment-1"))).toContain(
        loanDollars(short!.monthly * p)
      );
    }
    const meta = contextReelLayout(v, "facts", { progress: 1, rates: [1, 1] }, "navy").meta;
    expect(meta.source).toContain("hypothetical");
    expect(meta.publisher).toContain("Moneysmart");
    expect(meta.publisher).not.toContain("Reserve Bank");
  });
  it("waits for the second utterance and retains completed loan bars through the explanation", () => {
    const v = candidate("loans").stat.visualStory!;
    const render = (key: string, rates: [number, number]) =>
      splitMotion(contextReelLayout(v, key, { progress: 1, rates }, "navy").content).layers;
    const first = render("value", [1, 0]);
    expect(first.find((l) => l.id === "number-1")!.opacity).toBe(0);
    expect(first.find((l) => l.id === "bar-1")!.node.props.style.width).toBe(0);
    expect(render("value", [1, 1])).toEqual(render("line", [1, 1]));
  });
  it("draws a negative migration count left of the shared zero", () => {
    const d = testMigration();
    d.observations
      .filter((r) => r.state === "Queensland" && r.measure === "netInternalMigration")
      .forEach((r) => (r.people = -1000));
    const v = verifiedInterstateMigration(d, contextNow)!.stat.visualStory!;
    const layers = splitMotion(
      contextReelLayout(v, "value", { progress: 1, rates: [1, 1] }, "navy").content
    ).layers;
    const left = layers.find((l) => l.id === "bar-0")!,
      right = layers.find((l) => l.id === "bar-1")!;
    expect(left.x).toBe(0);
    expect(left.node.props.style.width).toBeGreaterThan(0);
    expect(right.x).toBe(left.node.props.style.width);
    expect(JSON.stringify(layers.find((l) => l.id === "number-0"))).toContain("−4,000");
  });
  it.each(["loans", "migration"])(
    "keeps every %s scene inside its actual rendered text bounds",
    async (kind) => {
      const v = candidate(kind).stat.visualStory!;
      for (const variant of ["light", "navy"] as const) {
        for (const line of v.script) {
          const layout = contextReelLayout(v, line.key, { progress: 1, rates: [1, 1] }, variant);
          const { staticTree, layers } = splitMotion(layout.content);
          await renderEditorialFrame(staticTree, variant, layout.meta);
          for (const l of layers.filter((l) => l.kind !== "rect")) {
            await renderEditorialLayer(
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    position: "relative",
                    width: l.width,
                    height: l.height,
                  },
                  children: l.node,
                },
              },
              l.width,
              l.height
            );
          }
        }
      }
    },
    60000
  );
});

const available = process.env.CI === "true" || existsSync(voiceModel());
describe.skipIf(!available)("real Fable context exports", () => {
  it.each(["loans", "migration"])(
    "renders the complete %s story with voice and subtitles",
    async (kind) => {
      const c = candidate(kind);
      const video = await renderStatReel(
        c.stat,
        kind === "loans" ? "navy" : "light",
        productionReelOptions(c.script)
      );
      expect(video.narrated).toBe(true);
      expect(video.subtitled).toBe(true);
      expect(video.seconds).toBeGreaterThan(15);
      expect(video.seconds).toBeLessThanOrEqual(32);
      expect(video.bytes.length).toBeGreaterThan(100_000);
      expect(video.timeline.find((s) => s.key === "value")!.phrases).toHaveLength(2);
    },
    180000
  );
});
