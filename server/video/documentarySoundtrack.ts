import { DOCUMENTARY_DIRECTION } from "./documentaryDirection";
import type { MeasuredPhrase } from "./phraseSpeech";

/** Original, deterministic instrumental score and transition Foley. No samples,
 * external music licence, speech cloning, downloads or paid generation service. */
export function documentarySoundtrack(
  scenes: Array<{ start: number; seconds: number; phrases: MeasuredPhrase[] }>,
  total: number
) {
  if (!Number.isFinite(total) || total <= 0 || total > 180 || scenes.length !== 8)
    throw new Error("Invalid documentary score duration.");
  if (
    scenes.some(
      (scene, i) =>
        !Number.isFinite(scene.start) ||
        scene.start < 0 ||
        (i > 0 && scene.start <= scenes[i - 1]!.start) ||
        !Number.isFinite(scene.seconds) ||
        scene.seconds <= 0 ||
        scene.start + scene.seconds > total + 0.001 ||
        scene.phrases.length !== 2 ||
        scene.phrases.some(
          (phrase, j) =>
            !Number.isFinite(phrase.start) ||
            phrase.start < 0 ||
            (j > 0 && phrase.start <= scene.phrases[j - 1]!.start) ||
            !Number.isFinite(phrase.seconds) ||
            phrase.seconds <= 0 ||
            // Container duration is reported to hundredths; phrase time is sample-exact.
            phrase.start + phrase.seconds > scene.seconds + 0.011
        )
    )
  )
    throw new Error("Invalid documentary score timeline.");
  const sr = DOCUMENTARY_DIRECTION.sound.sampleRate;
  const frames = Math.ceil(sr * total);
  const left = new Float32Array(frames),
    right = new Float32Array(frames);
  const tau = 2 * Math.PI;
  const note = (start: number, frequency: number, seconds: number, level: number, pan: number) => {
    const first = Math.max(0, Math.floor(start * sr));
    const n = Math.min(Math.floor(seconds * sr), frames - first);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const env = (1 - Math.exp(-t * 45)) * Math.exp(-t / 1.65) * Math.min(1, (seconds - t) / 0.4);
      const value =
        level *
        env *
        (Math.sin(tau * frequency * t) +
          0.23 * Math.sin(tau * frequency * 2.002 * t) +
          0.06 * Math.sin(tau * frequency * 3 * t));
      left[first + i]! += value * (1 - pan * 0.3);
      right[first + i]! += value * (1 + pan * 0.3);
      const echo = first + i + Math.floor(0.31 * sr);
      if (echo < frames) {
        left[echo]! += value * 0.12;
        right[echo]! += value * 0.19;
      }
    }
  };
  // Open fifths and a slow minor-key progression; resolve to a brighter C voicing.
  const chords = [
    [220, 261.626, 329.628],
    [174.614, 220, 261.626],
    [130.813, 195.998, 261.626],
    [195.998, 246.942, 293.665],
  ];
  for (let t = 0; t < total; t += 3.4) {
    const scene = scenes.findLastIndex((s) => s.start <= t);
    const crisis = scene === 3 && t < scenes[3]!.start + (scenes[3]!.phrases[1]?.start ?? 0);
    const chord = scene === 7 ? chords[2]! : chords[Math.floor(t / 13.6) % 4]!;
    if (!crisis) {
      note(t, chord[Math.floor(t / 3.4) % 3]!, 5, 0.019, Math.sin(t));
      if (Math.floor(t / 3.4) % 4 === 0) note(t, chord[0]! / 2, 8, 0.012, 0);
    } else {
      note(t, 55, 4, 0.021, 0);
    }
  }
  let shot = 0;
  for (const scene of scenes)
    for (const phrase of scene.phrases) {
      const cuts = DOCUMENTARY_DIRECTION.cuts[shot++]!;
      for (const cut of cuts) {
        const start = scene.start + phrase.start + phrase.seconds * cut;
        const first = Math.floor(start * sr);
        // Short soft mechanical taps. No cash register or false recorded ambience.
        for (let j = 0; j < Math.min(sr * 0.15, frames - first); j++) {
          const t = j / sr;
          const tap = Math.sin(tau * (shot === 7 ? 90 : 460) * t) * Math.exp(-t * 65) * 0.022;
          left[first + j]! += tap;
          right[first + j]! += tap;
        }
      }
    }
  const out = Buffer.alloc(44 + frames * 4);
  out.write("RIFF", 0);
  out.writeUInt32LE(out.length - 8, 4);
  out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(2, 22);
  out.writeUInt32LE(sr, 24);
  out.writeUInt32LE(sr * 4, 28);
  out.writeUInt16LE(4, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(frames * 4, 40);
  const peak = DOCUMENTARY_DIRECTION.sound.peak;
  for (let i = 0; i < frames; i++) {
    const t = i / sr,
      fade = Math.min(1, t / 0.8, (total - t) / 1.5);
    out.writeInt16LE(
      Math.round(Math.max(-peak, Math.min(peak, left[i]!)) * fade * 32767),
      44 + i * 4
    );
    out.writeInt16LE(
      Math.round(Math.max(-peak, Math.min(peak, right[i]!)) * fade * 32767),
      46 + i * 4
    );
  }
  return out;
}
