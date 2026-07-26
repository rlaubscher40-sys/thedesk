/**
 * "Say this on your next call" — full measure, never collapsed.
 *
 * The redesign's central move: this line and the partner angles are the
 * product, and they used to sit behind a "Ruben's read" toggle on every
 * card. Both now render inline, everywhere.
 *
 * Presentation is a pull quote on a 4px accent rule with the actions
 * beside it. Behaviour is unchanged: clipboard only, no logging, the same
 * 1.8s "Copied" state, and `dedash()` applied to both the rendered quote
 * and the clipboard payload so the line a partner pastes into a client
 * chat carries no em-dashes either.
 */
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { dedash } from "@/lib/dedash";
import { personaDisplayLabel, usePersona } from "@/lib/persona";

export function SayThis({
  sayThis,
  /** Extra actions rendered after "Copy line" — Save, source link, etc. */
  actions,
  /** Quote size. The Today lead runs at 34px, Story at 33px, cards at 19px. */
  size = 34,
  className,
  /** Name the persona the line is angled for in the label. */
  showPersona = true,
}: {
  sayThis: string;
  actions?: React.ReactNode;
  size?: number;
  className?: string;
  showPersona?: boolean;
}) {
  const { persona } = usePersona();
  const [copied, setCopied] = useState(false);
  const clean = dedash(sayThis);

  async function copy() {
    try {
      await navigator.clipboard.writeText(clean);
      setCopied(true);
      toast.success("Copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <div
      className={cn("pl-6 lg:pl-7", className)}
      style={{ borderLeft: "4px solid var(--color-accent-text)" }}
    >
      <p className="bs-label-accent" style={{ letterSpacing: "0.22em" }}>
        Say this on your next call
        {showPersona && ` — ${personaDisplayLabel(persona)}`}
      </p>
      <p
        className="font-serif mt-3"
        style={{
          fontSize: `clamp(22px, 2.4vw, ${size}px)`,
          lineHeight: 1.18,
          letterSpacing: "-0.03em",
          textWrap: "pretty",
        }}
      >
        &ldquo;{clean}&rdquo;
      </p>
      <div className="flex flex-wrap gap-2.5 mt-4">
        <button type="button" onClick={copy} className="bs-btn bs-btn-solid">
          {copied ? "Copied" : "Copy line"}
        </button>
        {actions}
      </div>
    </div>
  );
}
