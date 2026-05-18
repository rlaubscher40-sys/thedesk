/**
 * Edition audio player. Uses the browser's SpeechSynthesis API to read the
 * edition aloud, zero infra, free, works offline once the voice is loaded.
 *
 * Voice quality varies by OS (macOS / iOS have excellent neural voices;
 * Android is decent; desktop Linux can be rougher). We pick the best
 * en-AU voice when one's available, otherwise fall back to en-* and let
 * the OS choose.
 *
 * Not all browsers expose voices, feature-detected. Hidden when unsupported.
 */
import { useEffect, useRef, useState } from "react";
import { Headphones, Pause, Play, Square } from "lucide-react";

type State = "idle" | "playing" | "paused";

export function ListenButton({
  text,
  label = "Listen to this edition",
}: {
  /** Concatenated, plain-text version of the edition for the TTS engine. */
  text: string;
  label?: string;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [state, setState] = useState<State>("idle");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      setSupported(false);
      return;
    }
    setSupported("speechSynthesis" in window);
    // Stop any in-flight utterance when the component unmounts (e.g. on
    // page nav). Otherwise the synth keeps reading after we've left.
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function pickVoice(): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return null;
    // Prefer en-AU, then any en-*, then nothing.
    return (
      voices.find((v) => v.lang === "en-AU") ??
      voices.find((v) => v.lang?.startsWith("en")) ??
      null
    );
  }

  function start() {
    if (!text.trim() || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? "en-AU";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setState("idle");
    utterance.onerror = () => setState("idle");
    utteranceRef.current = utterance;

    window.speechSynthesis.speak(utterance);
    setState("playing");
  }

  function pause() {
    window.speechSynthesis.pause();
    setState("paused");
  }

  function resume() {
    window.speechSynthesis.resume();
    setState("playing");
  }

  function stop() {
    window.speechSynthesis.cancel();
    setState("idle");
  }

  if (supported === false) return null;

  return (
    <div
      className="inline-flex items-center gap-1 rounded-sm border border-[var(--color-border)] bg-[var(--color-bg-elevated)]/70 p-1 backdrop-blur-sm"
      role="group"
      aria-label={label}
    >
      {state === "idle" && (
        <button
          onClick={start}
          className="inline-flex items-center gap-1.5 rounded-sm px-3 py-2 sm:py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] min-h-[44px] text-[var(--color-fg-muted)] hover:text-amber-300 transition-colors"
          aria-label={label}
          title={label}
        >
          <Headphones className="h-3 w-3" />
          Listen
        </button>
      )}
      {state === "playing" && (
        <>
          <button
            onClick={pause}
            className="inline-flex items-center gap-1.5 rounded-sm px-3 py-2 sm:py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] min-h-[44px] text-amber-300 hover:text-amber-200 transition-colors"
            aria-label="Pause"
            title="Pause"
          >
            <Pause className="h-3 w-3" />
            Pause
          </button>
          <button
            onClick={stop}
            className="inline-flex items-center rounded-sm p-1.5 text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
            aria-label="Stop"
            title="Stop"
          >
            <Square className="h-3 w-3" />
          </button>
        </>
      )}
      {state === "paused" && (
        <>
          <button
            onClick={resume}
            className="inline-flex items-center gap-1.5 rounded-sm px-3 py-2 sm:py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] min-h-[44px] text-amber-300 hover:text-amber-200 transition-colors"
            aria-label="Resume"
            title="Resume"
          >
            <Play className="h-3 w-3" />
            Resume
          </button>
          <button
            onClick={stop}
            className="inline-flex items-center rounded-sm p-1.5 text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
            aria-label="Stop"
            title="Stop"
          >
            <Square className="h-3 w-3" />
          </button>
        </>
      )}
    </div>
  );
}
