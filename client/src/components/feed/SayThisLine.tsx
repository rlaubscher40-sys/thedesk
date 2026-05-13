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
    <div className="flex items-start gap-2.5 mt-3 p-3 border border-amber-500/15 bg-amber-500/5 rounded">
      <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-amber-400 shrink-0" />
      <div className="flex-1 min-w-0 text-sm leading-snug">
        <span className="overline block mb-1">Say this</span>
        <span className="text-[var(--color-fg)]">"{sayThis}"</span>
      </div>
      <button
        onClick={handleCopy}
        className="p-1.5 rounded text-[var(--color-fg-muted)] hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
        aria-label={copied ? "Copied" : "Copy line"}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
