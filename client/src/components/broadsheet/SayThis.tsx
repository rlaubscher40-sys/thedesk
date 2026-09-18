/**
 * The hook line — full measure, never collapsed.
 *
 * This stored line is shared across readers, so its label does not imply
 * persona-specific advice. Copying normalises dashes in the same way as
 * the displayed quote and reports clipboard failure explicitly.
 */
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { dedash } from "@/lib/dedash";

export function SayThis({
  sayThis,
  /** Extra actions rendered after "Copy line" — Save, source link, etc. */
  actions,
  /** Quote size. The Today lead runs at 34px, Story at 33px, cards at 19px. */
  size = 34,
  className,
}: {
  sayThis: string;
  actions?: React.ReactNode;
  size?: number;
  className?: string;
}) {
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
        The line worth remembering
      </p>
      <p
        className="font-serif mt-3"
        style={{
          fontSize: `clamp(1.375rem, 2.4vw, ${size / 16}rem)`,
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
