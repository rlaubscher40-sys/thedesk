/**
 * The 4-line partner-relevance block shown under every feed item with a tag.
 * Renders one labelled paragraph per persona, dimmed except the active one.
 *
 * On mobile (<768px) the block collapses by default — only the active
 * persona's line is shown, with a chevron to expand the other three.
 * Saves vertical real estate on what's typically a long scroll of
 * stacked feed cards. Choice persists in localStorage so a reader's
 * preference sticks across visits.
 */
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { parsePartnerTag, PARTNER_TAG_LABELS, type PartnerTagLabel } from "@shared/schemas";
import { cn } from "@/lib/cn";
import { PERSONA_COLOUR, usePersona } from "@/lib/persona";

const STORAGE_KEY = "thedesk:partner-angles-expanded";

function readInitialExpanded(): boolean {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "1") return true;
  if (stored === "0") return false;
  return window.innerWidth >= 768;
}

type Props = {
  /** Raw partnerTag string from the database. */
  raw: string | null;
};

export function PartnerTagBlock({ raw }: Props) {
  const parsed = parsePartnerTag(raw);
  const { persona } = usePersona();
  const [focused, setFocused] = useState<PartnerTagLabel | null>(null);
  const [expanded, setExpanded] = useState<boolean>(readInitialExpanded);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, expanded ? "1" : "0");
  }, [expanded]);

  if (!parsed) return null;

  // Persona keys from data are spelled identically to PARTNER_TAG_LABELS,
  // so the runtime persona doubles as the label key here.
  const activeLabel = persona as PartnerTagLabel;
  const visible: PartnerTagLabel[] = expanded
    ? [...PARTNER_TAG_LABELS]
    : [activeLabel];
  const hiddenCount = PARTNER_TAG_LABELS.length - visible.length;

  return (
    <div className="border-t border-[var(--color-border)] pt-4 mt-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="overline" style={{ letterSpacing: "0.18em" }}>
          Partner angles
        </p>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="inline-flex items-center gap-1 text-[var(--color-fg-subtle)] hover:text-amber-300 font-mono uppercase transition-colors"
          style={{ fontSize: "10px", letterSpacing: "0.18em" }}
          title={expanded ? "Collapse" : `Show all ${PARTNER_TAG_LABELS.length}`}
        >
          {expanded ? "Collapse" : `+${hiddenCount} more`}
          <ChevronDown
            className="h-3 w-3 transition-transform"
            style={{ transform: expanded ? "rotate(180deg)" : "none" }}
          />
        </button>
      </div>
      <div className="space-y-2">
        {visible.map((label) => (
          <PartnerTagLine
            key={label}
            label={label}
            text={parsed[label]}
            focused={focused === null || focused === label}
            onFocus={() => setFocused(focused === label ? null : label)}
          />
        ))}
      </div>
    </div>
  );
}

function PartnerTagLine({
  label,
  text,
  focused,
  onFocus,
}: {
  label: PartnerTagLabel;
  text: string;
  focused: boolean;
  onFocus: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onFocus}
      // Grid template gives every row identical column widths so the
      // labels align cleanly down a column — and full-length labels
      // like "INSTITUTIONAL" don't get ellipsis-truncated.
      className={cn(
        "grid grid-cols-[120px_minmax(0,1fr)] items-baseline gap-3 w-full text-left rounded py-1.5 px-2 -mx-2 transition-all",
        focused
          ? "opacity-100 hover:bg-white/5"
          : "opacity-35 hover:opacity-75 hover:bg-white/5"
      )}
    >
      <span
        className="font-mono uppercase tabular-nums"
        style={{
          // Per-persona accent — matches the VIEW AS pill colour for the
          // same label. Was a single amber for every row before, which
          // collapsed the visual distinction between the four personas.
          color: PERSONA_COLOUR[label],
          letterSpacing: "0.14em",
          fontSize: "10px",
        }}
      >
        {label}
      </span>
      <span
        className="text-[var(--color-fg-muted)] leading-relaxed"
        style={{ fontSize: "14.5px" }}
      >
        {text}
      </span>
    </button>
  );
}
