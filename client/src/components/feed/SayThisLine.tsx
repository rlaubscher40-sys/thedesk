/**
 * The "Say This" line on a feed item — a copy-ready one-liner. Clicking the
 * copy button writes to the clipboard *and* records the line in the
 * conversation tracker so the user can review what they actually used.
 */
import { useState } from "react";
import { Check, Copy, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/useAuth";
import { trpc } from "@/lib/trpc";

export function SayThisLine({
  sayThis,
  editionId,
  category,
}: {
  sayThis: string;
  editionId?: number;
  category?: string;
}) {
  const [copied, setCopied] = useState(false);
  const { isAuthenticated } = useAuth();
  const track = trpc.conversations.track.useMutation();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(sayThis);
      setCopied(true);
      if (isAuthenticated) {
        track.mutate({ editionId, lineText: sayThis, usedWithCategory: category });
      }
      toast.success("Copied. Track logged.");
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
        <p className="overline-amber mb-1">Say this</p>
        <p className="font-serif italic text-[var(--color-fg)] leading-snug text-base">
          "{sayThis}"
        </p>
      </div>
      <button
        onClick={handleCopy}
        className="p-1.5 rounded text-[var(--color-fg-muted)] hover:text-amber-300 hover:bg-amber-500/10 transition-colors shrink-0"
        aria-label={copied ? "Copied" : "Copy line"}
        title="Copy and log to tracker"
      >
        {copied ? <Check className="h-4 w-4 text-amber-300" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
