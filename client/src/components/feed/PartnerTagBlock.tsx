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
    <div className="border-t border-[var(--color-border)] pt-3 mt-3 space-y-2">
      <p className="overline">Partner angles</p>
      <div className="space-y-1.5">
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
        "block w-full text-left text-xs leading-relaxed transition-opacity",
        focused ? "opacity-100" : "opacity-40 hover:opacity-70"
      )}
    >
      <span className="font-mono text-[10px] uppercase tracking-wider text-amber-400/80 mr-2">
        {label}
      </span>
      <span className="text-[var(--color-fg-muted)]">{text}</span>
    </button>
  );
}
