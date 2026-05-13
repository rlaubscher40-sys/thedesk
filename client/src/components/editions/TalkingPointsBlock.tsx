/**
 * Renders the talkingPoints map (partner type -> line) on a topic. Each line
 * has a copy button that writes to the clipboard and logs to the tracker.
 */
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import type { TalkingPoints } from "@shared/schemas";
import { useAuth } from "@/lib/useAuth";
import { trpc } from "@/lib/trpc";

export function TalkingPointsBlock({ points }: { points: TalkingPoints }) {
  const entries = Object.entries(points).filter(([, v]) => v && v.trim().length > 0);
  if (entries.length === 0) return null;

  return (
    <div className="mt-5 pt-4 border-t border-[var(--color-border)]">
      <p className="overline mb-3">Talking points</p>
      <ul className="space-y-2.5">
        {entries.map(([partner, line], idx) => (
          // partner key is defensive — duplicate keys in the source JSON would
          // otherwise trigger React key warnings (issue #1).
          <TalkingPointLine
            key={`${partner || "partner"}-${idx}`}
            partner={partner}
            line={line}
          />
        ))}
      </ul>
    </div>
  );
}

function TalkingPointLine({ partner, line }: { partner: string; line: string }) {
  const [copied, setCopied] = useState(false);
  const { isAuthenticated } = useAuth();
  const track = trpc.conversations.track.useMutation();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(line);
      setCopied(true);
      if (isAuthenticated) track.mutate({ lineText: line, usedWithCategory: partner });
      toast.success(`Copied for ${partner}`);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <li className="flex items-start gap-3 text-sm">
      <span className="overline mt-1 w-28 shrink-0 truncate">{partner}</span>
      <span className="flex-1 leading-relaxed text-[var(--color-fg-muted)]">{line}</span>
      <button
        onClick={handleCopy}
        aria-label={copied ? "Copied" : `Copy line for ${partner}`}
        className="p-1 rounded text-[var(--color-fg-subtle)] hover:text-amber-300 shrink-0"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </li>
  );
}
