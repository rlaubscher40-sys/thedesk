/**
 * LinkedIn share modal.
 *
 * Why this exists: LinkedIn's URL-share API does not accept pre-filled post
 * text (issue #5 in the brief, `share-offsite?text=...` is silently
 * ignored). The least-bad workaround is to copy the text to the clipboard and
 * open a fresh post composer; the user pastes themselves. This component
 * automates exactly that flow and shows live feedback.
 *
 * It also addresses issue #6, a colour-coded character counter that maps to
 * LinkedIn's real truncation thresholds.
 */
import { Check, Copy, ExternalLink } from "lucide-react";
import { Linkedin } from "@/components/icons/BrandIcons";
import { useEffect, useMemo, useState } from "react";
import { LINKEDIN_LIMITS } from "@shared/const";
import { cn } from "@/lib/cn";
import { Button } from "./ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/Dialog";

const LINKEDIN_COMPOSE_URL = "https://www.linkedin.com/feed/?shareActive=true";

export type LinkedInPostModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-filled post text. Editable in the modal. */
  initialText: string;
  /** Optional title shown above the textarea. */
  heading?: string;
};

function charCountColour(count: number): { label: string; tone: "green" | "amber" | "red" } {
  if (count <= LINKEDIN_LIMITS.recommended) return { label: "well within limit", tone: "green" };
  if (count <= LINKEDIN_LIMITS.max) return { label: "near LinkedIn's limit", tone: "amber" };
  return { label: "LinkedIn will truncate this", tone: "red" };
}

export function LinkedInPostModal({ open, onOpenChange, initialText, heading }: LinkedInPostModalProps) {
  const [text, setText] = useState(initialText);
  const [copied, setCopied] = useState(false);

  // Reset whenever the modal is reopened with new content.
  useEffect(() => {
    if (open) {
      setText(initialText);
      setCopied(false);
    }
  }, [open, initialText]);

  const count = text.length;
  const { label, tone } = useMemo(() => charCountColour(count), [count]);

  async function copyAndOpenLinkedIn() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.open(LINKEDIN_COMPOSE_URL, "_blank", "noopener,noreferrer");
      // Brief flash of confirmation, then reset for next time.
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("[LinkedIn] clipboard write failed:", err);
    }
  }

  async function copyOnly() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("[LinkedIn] clipboard write failed:", err);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <div>
          <DialogTitle className="text-base font-serif">{heading ?? "Share to LinkedIn"}</DialogTitle>
          <DialogDescription className="text-xs text-[var(--color-fg-muted)] mt-1">
            LinkedIn does not accept pre-filled post text via URL. Copy below and paste into the composer.
          </DialogDescription>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          className="w-full bg-[var(--color-bg-deep)] border border-[var(--color-border)] rounded p-3 text-sm font-sans resize-y focus:outline-none focus:border-[var(--color-amber)]/50"
          aria-label="Post text"
        />

        <CharCounter count={count} tone={tone} label={label} />

        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={copyOnly}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy only"}
          </Button>
          <Button variant="primary" size="sm" onClick={copyAndOpenLinkedIn}>
            <Linkedin className="h-3.5 w-3.5" />
            Copy and open LinkedIn
            <ExternalLink className="h-3 w-3 opacity-70" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CharCounter({
  count,
  tone,
  label,
}: {
  count: number;
  tone: "green" | "amber" | "red";
  label: string;
}) {
  const toneClasses: Record<typeof tone, string> = {
    green: "text-emerald-400",
    amber: "text-amber-400",
    red: "text-red-400",
  };
  const widthPct = Math.min(100, (count / LINKEDIN_LIMITS.max) * 100);
  const barColour = {
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
  }[tone];

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
        <div
          className={cn("h-full transition-all", barColour)}
          style={{ width: `${widthPct}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="text-xs font-mono shrink-0">
        <span className={toneClasses[tone]}>{count.toLocaleString()}</span>
        <span className="text-[var(--color-fg-subtle)]"> / {LINKEDIN_LIMITS.max.toLocaleString()}</span>
        <span className="ml-2 text-[var(--color-fg-muted)] hidden sm:inline">{label}</span>
      </div>
    </div>
  );
}
