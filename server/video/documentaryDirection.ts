/** Authored edit points inside measured spoken phrases, not a fixed slide interval.
 * Fractions direct pictures and score together; they are not forced word alignment. */
export const DOCUMENTARY_DIRECTION = {
  version: 2,
  cuts: [
    [0, 0.48],
    [0, 0.52],
    [0, 0.26, 0.43, 0.59],
    [0, 0.3, 0.64],
    [0, 0.53],
    [0, 0.35, 0.76],
    [0, 0.2, 0.73],
    [0, 0.36],
    [0, 0.42, 0.7],
    [0, 0.55],
    [0, 0.3, 0.61],
    [0, 0.34, 0.65],
    [0, 0.56],
    [0, 0.42],
    [0, 0.66],
    [0, 0.22, 0.48],
  ],
  sound: { version: 2, sampleRate: 48000, peak: 0.11, duckRatio: 8 },
} as const;

export function documentaryEdit(shot: number, progress: number) {
  const cuts = DOCUMENTARY_DIRECTION.cuts[shot];
  if (!cuts || !Number.isFinite(progress)) throw new Error("Invalid documentary edit point.");
  const p = Math.max(0, Math.min(1, progress));
  const index = cuts.findLastIndex((start) => start <= p);
  const start = cuts[index]!;
  return { index, progress: (p - start) / ((cuts[index + 1] ?? 1) - start), start };
}
