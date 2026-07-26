/**
 * Lane nav — the row under the Today masthead.
 *
 * Left: the five feed channels plus Editions, as flat mono labels with a
 * 2px accent underline on the active lane. Right: "Angled for {persona} ▾",
 * which opens the persona radiogroup.
 *
 * This replaces the sticky FilterChips bar. Two things changed with it:
 * the bar is no longer sticky (the broadsheet wants an uninterrupted
 * column), and the category sub-filter moved to the Archive, where
 * browsing by topic actually belongs. The channel state, its localStorage
 * key and the APG tabs keyboard pattern are all unchanged.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/cn";
import { PERSONAS } from "@/data/editions/2026-05-15";
import { PERSONA_COLOUR, personaDisplayLabel, usePersona } from "@/lib/persona";
import { FEED_CHANNELS, FEED_CHANNEL_LABELS, type FeedChannel } from "@shared/const";
import { GUTTER } from "./tokens";

/** Short lane labels. The full FEED_CHANNEL_LABELS strings ("Australia's
 *  Top Stories") are too long for a nav row set at 0.2em tracking. */
const LANE_LABEL: Record<FeedChannel, string> = {
  AU: "Australia",
  PROPERTY: "Property",
  BUSINESS: "Business",
  TECH: "Tech & Science",
  GLOBAL: "Global",
};

export function LaneNav({
  channel,
  onChannelChange,
}: {
  channel: FeedChannel;
  onChannelChange: (next: FeedChannel) => void;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const tablistRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
    // Roving tabindex: when the keyboard moves the selection, focus follows
    // the newly-selected tab — but only if focus was already in the tablist,
    // so a deep link doesn't yank it.
    const active = document.activeElement;
    if (active && tablistRef.current?.contains(active) && active !== activeRef.current) {
      activeRef.current?.focus();
    }
  }, [channel]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const i = FEED_CHANNELS.indexOf(channel);
    let next: FeedChannel | undefined;
    if (e.key === "ArrowRight") next = FEED_CHANNELS[Math.min(i + 1, FEED_CHANNELS.length - 1)];
    else if (e.key === "ArrowLeft") next = FEED_CHANNELS[Math.max(i - 1, 0)];
    else if (e.key === "Home") next = FEED_CHANNELS[0];
    else if (e.key === "End") next = FEED_CHANNELS[FEED_CHANNELS.length - 1];
    else return;
    e.preventDefault();
    if (next) onChannelChange(next);
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
  };

  return (
    <div className={cn(GUTTER, "rule-hair-b")}>
      <div className="flex items-end gap-6 lg:gap-9">
        <div
          ref={tablistRef}
          role="tablist"
          aria-label="Content channels"
          onKeyDown={onKeyDown}
          className="no-scrollbar flex gap-6 lg:gap-9 overflow-x-auto pt-3 flex-1 min-w-0"
        >
          {FEED_CHANNELS.map((id) => {
            const active = id === channel;
            return (
              <button
                key={id}
                ref={active ? activeRef : undefined}
                role="tab"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onClick={() => onChannelChange(id)}
                title={FEED_CHANNEL_LABELS[id]}
                className="bs-link shrink-0 whitespace-nowrap pb-3"
                style={{
                  ...labelStyle,
                  color: active ? "var(--color-fg)" : "var(--color-fg-muted)",
                  borderBottom: active
                    ? "2px solid var(--color-accent-text)"
                    : "2px solid transparent",
                }}
              >
                {LANE_LABEL[id]}
              </button>
            );
          })}
          <Link
            href="/editions"
            className="bs-link shrink-0 whitespace-nowrap pb-3"
            style={{ ...labelStyle, color: "var(--color-fg-muted)" }}
          >
            Editions
          </Link>
        </div>

        <AngledFor className="hidden md:flex pb-3 shrink-0" />
      </div>
    </div>
  );
}

/**
 * "Angled for {persona} ▾" — the persona switch, as a disclosure over the
 * same radiogroup the old PersonaSwitcher used. Same `usePersona()` state
 * and `thedesk:active-persona` key; arrow keys move selection and focus.
 */
export function AngledFor({ className }: { className?: string }) {
  const { persona, setPersona } = usePersona();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const i = PERSONAS.indexOf(persona);
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") nextIndex = (i + 1) % PERSONAS.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      nextIndex = (i - 1 + PERSONAS.length) % PERSONAS.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = PERSONAS.length - 1;
    else return;
    e.preventDefault();
    const next = PERSONAS[nextIndex];
    if (!next) return;
    setPersona(next);
    groupRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      ?.[nextIndex]?.focus();
  }

  return (
    <div ref={wrapRef} className={cn("relative items-center gap-2", className)}>
      <span className="bs-label" style={{ fontSize: 11 }}>
        Angled for
      </span>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="bs-link"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--color-fg)",
          borderBottom: "1px dotted var(--color-fg-muted)",
        }}
      >
        {personaDisplayLabel(persona)} ▾
      </button>

      {open && (
        <div
          ref={groupRef}
          role="radiogroup"
          aria-label="Partner role this story's Say This line is angled for"
          onKeyDown={onKeyDown}
          className="absolute right-0 top-full z-30 mt-2 flex flex-col min-w-[210px] bg-[var(--color-bg-elevated)]"
          style={{ boxShadow: "0 12px 40px oklch(0 0 0 / 22%), inset 0 0 0 1px var(--color-border-strong)" }}
        >
          {PERSONAS.map((p) => {
            const active = p === persona;
            return (
              <button
                key={p}
                role="radio"
                aria-checked={active}
                tabIndex={active ? 0 : -1}
                onClick={() => {
                  setPersona(p);
                  setOpen(false);
                }}
                className="bs-row flex items-center gap-2.5 px-4 py-3 text-left rule-hair first:border-t-0"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: active ? "var(--color-fg)" : "var(--color-fg-muted)",
                }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: PERSONA_COLOUR[p], opacity: active ? 1 : 0.4 }}
                  aria-hidden="true"
                />
                {personaDisplayLabel(p)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Mobile persona row. The dropdown is a poor fit at 390px, so the same
 * radiogroup renders as a horizontally scrollable chip row instead —
 * every chip at least 44px tall.
 */
export function AngledForChips() {
  const { persona, setPersona } = usePersona();
  const groupRef = useRef<HTMLDivElement>(null);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const i = PERSONAS.indexOf(persona);
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") nextIndex = (i + 1) % PERSONAS.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      nextIndex = (i - 1 + PERSONAS.length) % PERSONAS.length;
    else return;
    e.preventDefault();
    const next = PERSONAS[nextIndex];
    if (!next) return;
    setPersona(next);
    groupRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      ?.[nextIndex]?.focus();
  }

  return (
    <div
      className={cn(GUTTER, "no-scrollbar rule-hair-b md:hidden flex items-center gap-2 overflow-x-auto py-2")}
    >
      <span className="bs-label shrink-0" style={{ fontSize: 9.5 }}>
        Angled for
      </span>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label="Partner role this story's Say This line is angled for"
        onKeyDown={onKeyDown}
        className="flex items-center gap-2"
      >
        {PERSONAS.map((p) => {
          const active = p === persona;
          return (
            <button
              key={p}
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onClick={() => setPersona(p)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-sm px-3",
                active ? "bs-btn-solid" : "bs-btn-outline"
              )}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9.5,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                minHeight: 44,
              }}
            >
              {personaDisplayLabel(p)}
            </button>
          );
        })}
      </div>
      {/* Trailing spacer so the last chip clears the gutter when scrolled. */}
      <span className="shrink-0" style={{ width: 8 }} aria-hidden="true" />
    </div>
  );
}
