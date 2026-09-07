import { describe, expect, it } from "vitest";
import { buildSparkline, project, seriesRange, thin, traceTo, type SparkPoint } from "./sparkline";

const opts = { width: 900, height: 200, stroke: "#fff", accent: "#e5b45e" };

function at(month: number): Date {
  return new Date(Date.UTC(2024, month, 1));
}

describe("thin", () => {
  it("leaves a series that already fits alone", () => {
    expect(thin([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });

  it("keeps the first and last readings, which are the two that are claimed", () => {
    // The caption says the range. Dropping either end would make the caption
    // describe a series that was not drawn.
    const long = Array.from({ length: 400 }, (_, i) => i);
    const out = thin(long, 20);
    expect(out).toHaveLength(20);
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(399);
  });
});

describe("project", () => {
  it("puts the highest reading at the top and the lowest at the bottom", () => {
    // SVG y grows downward, which is the easy thing to get inverted.
    const pts = project([5, 1, 9], opts.width, opts.height);
    expect(pts[2]!.y).toBeLessThan(pts[0]!.y);
    expect(pts[1]!.y).toBeGreaterThan(pts[0]!.y);
  });

  it("spreads the readings evenly across the width", () => {
    const pts = project([1, 2, 3], opts.width, opts.height);
    expect(pts[1]!.x - pts[0]!.x).toBeCloseTo(pts[2]!.x - pts[1]!.x, 5);
  });

  it("draws a flat series down the middle rather than dividing by nothing", () => {
    const pts = project([4, 4, 4], opts.width, opts.height);
    for (const p of pts) expect(Number.isFinite(p.y)).toBe(true);
    expect(new Set(pts.map((p) => p.y)).size).toBe(1);
  });

  it("centres a single reading rather than pinning it to the left edge", () => {
    const [only] = project([7], opts.width, opts.height);
    expect(only!.x).toBeCloseTo(opts.width / 2, 0);
  });
});

describe("traceTo", () => {
  it("interpolates the head rather than snapping it to the nearest reading", () => {
    // Snapped, the head moves in visible jumps a few times a second.
    const pts = project([0, 10], 100, 100);
    const half = traceTo(pts, 0.5);
    const head = half[half.length - 1]!;
    expect(head.x).toBeGreaterThan(pts[0]!.x);
    expect(head.x).toBeLessThan(pts[1]!.x);
  });

  it("reaches the live reading exactly at full progress", () => {
    const pts = project([1, 2, 3, 4], 100, 100);
    expect(traceTo(pts, 1)).toEqual(pts);
  });

  it("never runs past the ends", () => {
    const pts = project([1, 2, 3], 100, 100);
    expect(traceTo(pts, 2)).toEqual(pts);
    expect(traceTo(pts, -1)).toHaveLength(1);
  });
});

describe("buildSparkline", () => {
  it("draws the line and marks where the series is now", () => {
    const svg = buildSparkline([1, 4, 2, 8], opts);
    expect(svg).toContain("<polyline");
    expect(svg).toContain(`fill="${opts.accent}"`); // the head
  });

  it("holds the baseline from the start, so the chart does not grow into place", () => {
    const svg = buildSparkline([1, 4, 2, 8], { ...opts, progress: 0 });
    expect(svg).toContain("<line");
    expect(svg).not.toContain("<polyline"); // nothing drawn yet
  });

  it("survives a series too short to be a line", () => {
    expect(() => buildSparkline([], opts)).not.toThrow();
    expect(buildSparkline([], opts)).not.toContain("<polyline");
  });
});

describe("seriesRange", () => {
  const pt = (month: number): SparkPoint => ({ value: 1, at: at(month) });

  it("names the two ends of what was actually drawn", () => {
    expect(seriesRange([pt(2), pt(5), pt(7)])).toBe("MAR 2024 — AUG 2024");
  });

  it("does not claim a range when every reading is from one month", () => {
    expect(seriesRange([pt(2), pt(2)])).toBe("MAR 2024");
  });

  it("says nothing rather than something wrong when there is nothing", () => {
    expect(seriesRange([])).toBeNull();
  });
});
