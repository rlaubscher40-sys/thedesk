/**
 * The 4-line partner-relevance block shown under every feed item with a tag.
 * Renders one labelled paragraph per persona, dimmed except the active one.
 */
import { useState } from "react";
import { parsePartnerTag, PARTNER_TAG_LABELS, type PartnerTagLabel } from "@shared/schemas";
import { cn } from "@/lib/cn";

type Props = {
  /** Raw partnerTag string from the database. */
  raw: string | null;
};

export function PartnerTagBlock({ raw }: Props) {
  const parsed = parsePartnerTag(raw);
  const [focused, setFocused] = useState<PartnerTagLabel | null>(null);

  if (!parsed) return null;

  return (
    <div className="border-t border-[var(--color-border)] pt-4 mt-5">
      <p className="overline mb-3">Partner angles</p>
      <div className="space-y-2">
        {PARTNER_TAG_LABELS.map((label) => (
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
      className={cn(
        "block w-full text-left text-sm leading-relaxed transition-all rounded py-1 px-2 -mx-2",
        focused
          ? "opacity-100 hover:bg-white/5"
          : "opacity-35 hover:opacity-75 hover:bg-white/5"
      )}
    >
      <span
        className="font-mono text-[10px] uppercase tracking-wider mr-3 inline-block w-24 truncate align-middle"
        style={{ color: "oklch(0.85 0.16 75 / 80%)", letterSpacing: "0.14em" }}
      >
        {label}
      </span>
      <span className="text-[var(--color-fg-muted)] align-middle">{text}</span>
    </button>
  );
}
