import { describe, expect, it } from "vitest";
import {
  buildAudioGraph,
  buildVideoGraph,
  composeSections,
  countUpFrames,
  estimateScriptSeconds,
  layout,
  MAX_REEL_SECONDS,
  parseDuration,
  scriptFitsClip,
  REEL_HEIGHT,
  REEL_WIDTH,
  type Beat,
} from "./statReel";
import { estimateSpeechSeconds } from "./narration";

function beat(seconds: number, fade = 0): Beat {
  return { frame: { reveal: 1 }, seconds, fade };
}

const stat = {
  label: "Unemployment rate",
  value: "4.3%",
  line: "Unemployment held at 4.3 per cent in July.",
  subtext: "LOWEST SINCE MARCH 2023 · ABS",
};

describe("countUpFrames", () => {
  it("ends on the exact figure the card shows", () => {
    // The last tick is the number. Anything else and the clip ends on a lie.
    const frames = countUpFrames("4.3%");
    expect(frames[frames.length - 1]).toBe("4.3%");
  });

  it("keeps the prefix, suffix and decimals of the real value", () => {
    for (const f of countUpFrames("$815,439")) {
      expect(f).toMatch(/^\$[\d,]+$/);
    }
    for (const f of countUpFrames("4.3%")) {
      expect(f).toMatch(/^\d\.\d%$/);
    }
  });

  it("never changes the width of the number", () => {
    // A count from zero would go "0%" -> "4.3%", reflowing the card under the
    // hero on every tick. Starting at the same digit width keeps it still.
    for (const value of ["4.3%", "$815,439", "12,480"]) {
      const widths = new Set(countUpFrames(value).map((f) => f.length));
      expect(widths).toEqual(new Set([value.length]));
    }
  });

  it("decelerates into the figure rather than arriving at speed", () => {
    const nums = countUpFrames("400").map(Number);
    const firstStep = (nums[1] ?? 0) - (nums[0] ?? 0);
    const lastStep = (nums[nums.length - 1] ?? 0) - (nums[nums.length - 2] ?? 0);
    expect(lastStep).toBeLessThan(firstStep);
  });

  it("climbs, so the number is arriving rather than falling", () => {
    const nums = countUpFrames("$815,439").map((f) => Number(f.replace(/[$,]/g, "")));
    for (let i = 1; i < nums.length; i++) expect(nums[i]!).toBeGreaterThanOrEqual(nums[i - 1]!);
  });

  it("gives up rather than guessing when there is no number to count", () => {
    expect(countUpFrames("n/a")).toEqual([]);
    expect(countUpFrames("0")).toEqual([]);
  });

  it("runs no count at all rather than a stalled one", () => {
    // An exact power of ten has nothing below it at the same width, so there
    // is nothing to count through. Ten identical frames would read as a freeze
    // and cost ten renders to produce.
    expect(countUpFrames("100")).toEqual([]);
  });

  it("never repeats a tick, so the count never appears to stall", () => {
    const frames = countUpFrames("4.3%");
    expect(new Set(frames).size).toBe(frames.length);
  });
});

describe("layout", () => {
  it("measures start times through the dissolves, not as a naive sum", () => {
    // Each cross-dissolve shortens the timeline by its own length. Summing
    // durations instead would drift the voice later on every beat, and by the
    // end of a clip that is most of a second out of sync.
    const { starts, total } = layout([
      { key: "a", frames: [{ reveal: 0 }], seconds: 2 },
      { key: "b", frames: [{ reveal: 1 }], seconds: 2 },
    ]);
    const fade = 10 / 30; // SECTION_FADE, in frames because everything is
    expect(starts[0]).toBe(0);
    expect(starts[1]).toBeCloseTo(2 - fade, 5); // the dissolve begins early
    expect(total).toBeCloseTo(4 - fade, 5);
  });

  it("gives the last frame of a section whatever the fixed frames leave", () => {
    // A long sentence should hold its card longer, not cut away mid-word.
    const { beats } = layout([
      {
        key: "value",
        frames: [
          { reveal: 0.3, valueText: "1.0%", seconds: 0.1 },
          { reveal: 0.3, valueText: "4.3%", seconds: 0.1 },
          { reveal: 0.3 },
        ],
        seconds: 3,
      },
    ]);
    expect(beats.map((b) => b.seconds)).toEqual([0.1, 0.1, 2.8]);
  });

  it("never leaves a frame on screen too briefly to read", () => {
    const { beats } = layout([
      { key: "a", frames: [{ reveal: 0, seconds: 5 }, { reveal: 1 }], seconds: 1 },
    ]);
    expect(beats[1]!.seconds).toBeGreaterThanOrEqual(0.55);
  });

  it("opens on a hard cut and dissolves everywhere after", () => {
    const { beats } = layout([
      { key: "a", frames: [{ reveal: 0 }], seconds: 1 },
      { key: "b", frames: [{ reveal: 1 }], seconds: 1 },
    ]);
    expect(beats[0]!.fade).toBe(0);
    expect(beats[1]!.fade).toBeGreaterThan(0);
  });

  it("dissolves the count-up ticks faster than it dissolves passages", () => {
    // A section-length dissolve between ticks would smear the digits; a hard
    // cut would strobe them. The tick fade is the difference.
    const { beats } = layout([
      { key: "a", frames: [{ reveal: 0 }], seconds: 1 },
      {
        key: "value",
        frames: [{ reveal: 0.3, valueText: "1.0%" }, { reveal: 0.3 }],
        seconds: 2,
      },
    ]);
    expect(beats[2]!.fade).toBeLessThan(beats[1]!.fade);
    expect(beats[2]!.fade).toBeGreaterThan(0);
  });
});

describe("buildVideoGraph", () => {
  it("gives zoompan a per-beat frame count, never a looped stream", () => {
    // zoompan emits `d` frames for EVERY frame it is given. Feeding it a
    // stream multiplies frames catastrophically — the first version of this
    // produced a 118MB file in four and a half minutes for a ten second clip.
    const graph = buildVideoGraph([beat(2)]);
    expect(graph).toContain("d=60"); // 2s at 30fps
    expect(graph).not.toContain("loop");
  });

  it("anchors the zoom at the centre of the frame", () => {
    // zoompan defaults its crop to the top-left corner. Without these the clip
    // drifts off the number instead of pushing into it, which is most of why
    // the silent version looked cheap.
    const graph = buildVideoGraph([beat(2)]);
    expect(graph).toContain("x='iw/2-(iw/zoom/2)'");
    expect(graph).toContain("y='ih/2-(ih/zoom/2)'");
  });

  it("supersamples before the zoom so a pushed-in frame stays sharp", () => {
    const graph = buildVideoGraph([beat(2)]);
    expect(graph).toContain(`scale=${REEL_WIDTH * 2}:${REEL_HEIGHT * 2}`);
    expect(graph).toContain(`s=${REEL_WIDTH}x${REEL_HEIGHT}`);
  });

  it("runs one continuous zoom across the clip rather than restarting each beat", () => {
    // Restarting at 1.0 on every cut is a visible hitch. Beat two must pick up
    // where beat one left off.
    const graph = buildVideoGraph([beat(2), beat(2, 0.3)]);
    const froms = [...graph.matchAll(/z='([\d.]+)\+/g)].map((m) => Number(m[1]));
    expect(froms).toHaveLength(2);
    expect(froms[0]).toBeCloseTo(1.0, 5);
    expect(froms[1]!).toBeGreaterThan(froms[0]!);
  });

  it("cross-dissolves the beats instead of cutting between them", () => {
    const graph = buildVideoGraph([beat(2), beat(2, 0.3), beat(2, 0.3)]);
    expect(graph).toContain("xfade=transition=fade:duration=0.300");
    expect(graph).not.toContain("concat");
    expect(graph).toContain("[vout]");
  });

  it("places each dissolve at the end of the chain so far, not of the beat", () => {
    // The second dissolve starts 0.3 earlier than a naive running total, and
    // getting this wrong is a frozen frame in the middle of the clip.
    const graph = buildVideoGraph([beat(2), beat(2, 0.3), beat(2, 0.3)]);
    expect(graph).toContain("offset=1.700"); // 2 - 0.3
    expect(graph).toContain("offset=3.400"); // (2 + 2 - 0.3) - 0.3
  });

  it("still produces an output label for a single-beat clip", () => {
    expect(buildVideoGraph([beat(2)])).toContain("[vout]");
  });

  it("sets square pixels, so the frame is not stretched on playback", () => {
    expect(buildVideoGraph([beat(1)])).toContain("setsar=1");
  });

  it("never emits a zero-frame beat", () => {
    // A beat rounded to nothing would make ffmpeg reject the whole graph.
    expect(buildVideoGraph([beat(0.001)])).toContain("d=1");
  });
});

describe("buildAudioGraph", () => {
  it("delays each passage to the moment its pictures arrive", () => {
    const graph = buildAudioGraph([0, 2.5], 4, 8);
    expect(graph).toContain("[4:a]adelay=delays=0:all=1[a0]");
    expect(graph).toContain("[5:a]adelay=delays=2500:all=1[a1]");
  });

  it("does not let the mixer quieten the voice as passages are added", () => {
    // amix divides by its input count by default. The passages never overlap,
    // so that would make a five-line clip a fifth as loud as a one-line clip.
    expect(buildAudioGraph([0, 2, 4], 3, 9)).toContain("normalize=0");
  });

  it("fades out before the loop point", () => {
    // Instagram cuts straight back to frame one; a voice stopping dead there
    // is audible.
    expect(buildAudioGraph([0, 2], 2, 10)).toContain("afade=t=out:st=9.400");
  });

  it("skips the mixer entirely for a single passage", () => {
    const graph = buildAudioGraph([0], 1, 5);
    expect(graph).not.toContain("amix");
    expect(graph).toContain("[aout]");
  });

  it("emits nothing when there is no narration", () => {
    expect(buildAudioGraph([], 0, 5)).toBe("");
  });
});

describe("composeSections", () => {
  const durations = { label: 1.2, value: 1.4, line: 3.4, claim: 2.6, signOff: 2.9 };

  it("counts the number up under the passage that says it", () => {
    const value = composeSections(stat, durations).find((s) => s.key === "value")!;
    expect(value.frames.length).toBeGreaterThan(5);
    expect(value.frames.every((f) => f.reveal === 0.3)).toBe(true);
    expect(value.frames[value.frames.length - 1]!.valueText).toBeUndefined();
  });

  it("holds the finished card while the sign-off plays", () => {
    const sections = composeSections(stat, durations);
    expect(sections[sections.length - 1]!.key).toBe("signOff");
    expect(sections[sections.length - 1]!.frames[0]!.reveal).toBe(1);
  });

  it("gives the count-up its ticks on top of the passage, not out of it", () => {
    // Otherwise the voice would still be saying the figure after the count had
    // finished and the card had moved on.
    const value = composeSections(stat, durations).find((s) => s.key === "value")!;
    expect(value.seconds).toBeGreaterThan(durations.value);
  });

  it("drops a passage that has nothing to say rather than holding on silence", () => {
    const keys = composeSections({ ...stat, subtext: "" }, durations).map((s) => s.key);
    expect(keys).not.toContain("claim");
    expect(keys).toContain("signOff");
  });

  it("lands in the range a Reel is actually watched at", () => {
    const { total } = layout(composeSections(stat, durations));
    expect(total).toBeGreaterThan(10);
    expect(total).toBeLessThan(30);
  });
});

describe("parseDuration", () => {
  it("reads the length off ffmpeg's header line", () => {
    expect(parseDuration("  Duration: 00:00:04.13, start: 0.025057, bitrate: 96 kb/s")).toBeCloseTo(
      4.13,
      5
    );
  });

  it("handles a clip long enough to have minutes", () => {
    expect(parseDuration("Duration: 00:02:07.50,")).toBeCloseTo(127.5, 5);
  });

  it("returns null rather than a wrong number when ffmpeg said nothing useful", () => {
    // The caller falls back to the estimate; a fabricated duration would cut
    // the pictures against a voice that is not there.
    expect(parseDuration("Output file is empty")).toBeNull();
  });
});

describe("layout, with a history line to draw", () => {
  it("spreads the drawing frames evenly across the passage", () => {
    // Left to the fixed-frame default they would run off in half a second and
    // then hold, which is a line that snaps rather than draws.
    const { beats } = layout([
      {
        key: "line",
        frames: [
          { reveal: 0.6, seriesProgress: 0.2 },
          { reveal: 0.6, seriesProgress: 0.4 },
          { reveal: 0.6, seriesProgress: 0.6 },
          { reveal: 0.6, seriesProgress: 0.8 },
        ],
        seconds: 4,
      },
    ]);
    expect(beats.map((b) => b.seconds)).toEqual([1, 1, 1, 1]);
  });

  it("still lets the count-up ticks keep their own timing", () => {
    const { beats } = layout([
      {
        key: "value",
        frames: [
          { reveal: 0.3, valueText: "1.0%", seconds: 0.1 },
          { reveal: 0.3, valueText: "4.3%", seconds: 0.1 },
          { reveal: 0.3 },
        ],
        seconds: 3,
      },
    ]);
    expect(beats.map((b) => b.seconds)).toEqual([0.1, 0.1, 2.8]);
  });
});

describe("composeSections, with a history line", () => {
  const durations = { label: 1.2, value: 1.4, line: 3.4, claim: 2.6, signOff: 2.9 };
  const series = Array.from({ length: 24 }, (_, i) => ({
    value: 100 + i,
    at: new Date(Date.UTC(2024, i, 1)),
  }));

  it("draws the line across the sentence and the claim, ending on the live reading", () => {
    const sections = composeSections({ ...stat, series }, durations);
    const line = sections.find((s) => s.key === "line")!;
    const claim = sections.find((s) => s.key === "claim")!;
    expect(line.frames.length).toBeGreaterThan(1);
    expect(line.frames[0]!.seriesProgress).toBeGreaterThan(0);
    // The head of the line reaches today exactly as the claim about it lands.
    expect(claim.frames[claim.frames.length - 1]!.seriesProgress).toBe(1);
  });

  it("never draws backwards", () => {
    const progress = composeSections({ ...stat, series }, durations)
      .flatMap((s) => s.frames)
      .map((f) => f.seriesProgress)
      .filter((p): p is number => p !== undefined);
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i]!).toBeGreaterThanOrEqual(progress[i - 1]!);
    }
  });

  it("holds a single still per passage when there is no history to draw", () => {
    // Two readings is a slope, not an archive. Animating one would claim a
    // history that is not there.
    const thin = series.slice(0, 3);
    const sections = composeSections({ ...stat, series: thin }, durations);
    expect(sections.find((s) => s.key === "line")!.frames).toHaveLength(1);
  });
});

describe("composeSections, with supporting figures", () => {
  const durations = { label: 1.2, value: 1.4, line: 3.4, claim: 2.6, signOff: 2.9 };
  const facts = [
    { figure: "+410", caption: "Up on the previous reading" },
    { figure: "8,495 — 13,250", caption: "Range across every reading we hold" },
    { figure: "10,715", caption: "Typical reading over the period" },
  ];

  it("brings the figures in one at a time", () => {
    const section = composeSections({ ...stat, facts }, durations).find((s) => s.key === "facts")!;
    expect(section.frames.map((f) => f.factsShown)).toEqual([1, 2, 3]);
  });

  it("holds all of them through the sign-off", () => {
    const sections = composeSections({ ...stat, facts }, durations);
    expect(sections[sections.length - 1]!.frames[0]!.factsShown).toBe(facts.length);
  });

  it("gives each figure the same time on screen", () => {
    // They are not narrated, so a constant is the only thing pacing them.
    const { beats } = layout(composeSections({ ...stat, facts }, durations));
    const factBeats = beats.filter((b) => b.frame.factsShown !== undefined && b.frame.reveal === 1);
    const held = new Set(factBeats.slice(0, facts.length).map((b) => b.seconds.toFixed(3)));
    expect(held.size).toBe(1);
  });

  it("skips the beat entirely when there are no figures to show", () => {
    const keys = composeSections(stat, durations).map((s) => s.key);
    expect(keys).not.toContain("facts");
  });

  it("keeps the clip inside the length a Reel is watched at", () => {
    const { total } = layout(composeSections({ ...stat, facts }, durations));
    expect(total).toBeGreaterThan(12);
    expect(total).toBeLessThan(35);
  });
});

describe("the frame grid", () => {
  // zoompan emits whole frames, so a beat asked for 0.075s becomes 0.0667s.
  // Offsets computed from the requested figures then sit past where the stream
  // actually ends, xfade silently emits almost nothing, and a clip that should
  // run 18.6 seconds comes out at 5.9 with no error from ffmpeg.
  const frames = (seconds: number) => seconds * 30;

  it("snaps every beat to a whole number of frames", () => {
    const { beats } = layout([
      { key: "a", frames: [{ reveal: 0, seconds: 0.075 }, { reveal: 1 }], seconds: 1.31 },
      { key: "b", frames: [{ reveal: 1 }], seconds: 2.77 },
    ]);
    for (const beat of beats) {
      expect(frames(beat.seconds) % 1).toBeCloseTo(0, 9);
      expect(frames(beat.fade) % 1).toBeCloseTo(0, 9);
    }
  });

  it("reports a total that is what ffmpeg will actually produce", () => {
    const { beats, total } = layout([
      { key: "a", frames: [{ reveal: 0, seconds: 0.075 }, { reveal: 1 }], seconds: 1.31 },
      { key: "b", frames: [{ reveal: 1 }], seconds: 2.77 },
    ]);
    const fromFrames =
      beats.reduce((n, b, i) => n + frames(b.seconds) - (i === 0 ? 0 : frames(b.fade)), 0) / 30;
    expect(total).toBeCloseTo(fromFrames, 9);
  });

  it("never lets a dissolve be as long as the beat it arrives into", () => {
    // xfade rejects a duration that is not shorter than both its inputs.
    const { beats } = layout([
      { key: "a", frames: [{ reveal: 0 }], seconds: 1 },
      { key: "b", frames: [{ reveal: 1, seconds: 0.04 }, { reveal: 1 }], seconds: 1 },
    ]);
    for (const beat of beats.slice(1)) expect(beat.fade).toBeLessThan(beat.seconds);
  });
});

describe("clip length", () => {
  const line = (key: string, words: number) => ({ key, text: "word ".repeat(words).trim() });

  it("accepts a script that runs the length of a Reel someone finishes", () => {
    const script = [
      line("label", 11),
      line("value", 7),
      line("line", 13),
      line("claim", 11),
      line("facts", 16),
      line("signOff", 7),
    ];
    expect(estimateScriptSeconds(script)).toBeLessThan(MAX_REEL_SECONDS);
    expect(scriptFitsClip(script)).toBe(true);
  });

  it("rejects one that would run past it", () => {
    // A model writes to its cap, so a cap set too loosely is a long clip every
    // time rather than occasionally. The first set of caps allowed sixty
    // seconds — this is the backstop underneath them.
    expect(scriptFitsClip([line("label", 60), line("value", 60), line("facts", 60)])).toBe(false);
  });

  it("counts the overhead a clip carries on top of the speech", () => {
    // Tails and the count-up are what make a twenty-two second script a
    // twenty-seven second Reel; ignoring them is how the cap gets set wrong.
    const script = [line("label", 10), line("signOff", 6)];
    const speech = script.reduce((n, l) => n + estimateSpeechSeconds(l.text), 0);
    expect(estimateScriptSeconds(script)).toBeGreaterThan(speech);
  });
});
