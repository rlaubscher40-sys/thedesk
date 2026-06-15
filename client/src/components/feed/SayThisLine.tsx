/**
 * The "Say This" line on a feed item, a copy-ready one-liner the partner
 * can paste straight into a client conversation. Pure clipboard, no
 * server-side logging.
 */
import { useState } from "react";
import { Check, Copy, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { dedash } from "@/lib/dedash";

export function SayThisLine({
  sayThis,
}: {
  sayThis: string;
  /** Accepted but unused, preserved so callers can keep passing context
   *  for future analytics without a signature change. */
  editionId?: number;
  category?: string;
}) {
  const [copied, setCopied] = useState(false);
  // De-dash for both the on-card quote and what lands on the clipboard, so the
  // line a partner pastes into a client chat carries no em-dashes either.
  const clean = dedash(sayThis);

  async function handleCopy() {
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
      className="flex items-start gap-3 mt-5 p-4 rounded relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, oklch(0.75 0.18 70 / 9%) 0%, oklch(0.75 0.18 70 / 4%) 100%)",
        border: "1px solid oklch(0.75 0.18 70 / 22%)",
        boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 3%)",
      }}
    >
      <div
        className="h-7 w-7 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0"
        aria-hidden="true"
      >
        <MessageSquare className="h-3.5 w-3.5 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="overline-amber mb-1.5">Say this</p>
        {/* Quote rendered in serif but NOT italic, italic Playfair at
            body sizes was reading as cramped on a tinted background. The
            opening + closing glyphs frame the pull quote without making
            the actual text hard to read. */}
        <p
          className="font-serif text-[var(--color-fg)] leading-snug"
          style={{ fontSize: "15.5px" }}
        >
          <span
            aria-hidden="true"
            className="text-amber-300/70 mr-0.5 font-serif"
            style={{ fontSize: "20px", lineHeight: 0 }}
          >
            ❝
          </span>
          {clean}
          <span
            aria-hidden="true"
            className="text-amber-300/70 ml-0.5 font-serif"
            style={{ fontSize: "20px", lineHeight: 0 }}
          >
            ❞
          </span>
        </p>
      </div>
      <button
        onClick={handleCopy}
        className="p-1.5 rounded text-[var(--color-fg-muted)] hover:text-amber-300 hover:bg-amber-500/10 transition-colors shrink-0"
        aria-label={copied ? "Copied" : "Copy line"}
        title="Copy to clipboard"
      >
        {copied ? <Check className="h-4 w-4 text-amber-300" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
