import { describe, expect, it } from "vitest";
import { renderSignalCard } from "./signalCard";

describe("renderSignalCard", () => {
  it("renders a 1080x1350 PNG for The Number format", async () => {
    const png = await renderSignalCard({
      label: "Investor lending growth",
      value: "+8.4%",
      context: "Investor credit is accelerating while owner-occupier growth is steadier.",
      move: "+2.1% across recorded history",
      deskTake: "The direction matters more than one monthly print. Credit appetite is rebuilding.",
      source: "ABS",
      asOf: "7 Sep 2026",
    });
    expect(png).toBeInstanceOf(Buffer);
    expect(png.byteLength).toBeGreaterThan(20_000);
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4e);
    expect(png[3]).toBe(0x47);
  });

  it("degrades cleanly when optional context is absent", async () => {
    const png = await renderSignalCard({
      label: "Cash rate",
      value: "3.60%",
      context: null,
      move: null,
      deskTake: null,
      source: "RBA",
      asOf: null,
    });
    expect(png.byteLength).toBeGreaterThan(20_000);
  });
});
