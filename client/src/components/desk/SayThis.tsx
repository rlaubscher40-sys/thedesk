/**
 * SAY THIS quote block — the editorial moment on each card.
 *
 * Renders the active persona's Say This line in italic serif inside a
 * tinted panel. Three actions sit below: Copy, Share (opens LinkedIn
 * compose, copies text first), Copy link (copies the source URL).
 *
 * Each action shows a 2-second toast on success — the toast layer is
 * announced via role="status" by sonner so screen readers pick it up.
 *
 * Logs the copied line to the conversation tracker when the user is
 * authenticated so the auto-log stays intact.
 */
import { useState } from "react";
import { Check, Copy, Link2, Linkedin, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/useAuth";
import { PERSONA_COLOUR } from "@/lib/persona";
import { trpc } from "@/lib/trpc";
import type { Persona, Story } from "@/data/editions/2026-05-15";

type Props = {
  story: Story;
  /** The persona whose Say This is currently active. */
  persona: Persona;
  sayThis: string;
};

const LINKEDIN_COMPOSE_URL = "https://www.linkedin.com/feed/?shareActive=true";

export function SayThis({ story, persona, sayThis }: Props) {
  const [copied, setCopied] = useState<"text" | "link" | null>(null);
  const { isAuthenticated } = useAuth();
  const track = trpc.conversations.track.useMutation();

  async function copyText() {
    try {
      await navigator.clipboard.writeText(sayThis);
      setCopied("text");
      if (isAuthenticated) {
        track.mutate({ lineText: sayThis, usedWithCategory: persona });
      }
      toast.success("Copied. Logged to tracker.");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(story.sourceUrl);
      setCopied("link");
      toast.success("Link copied.");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(`${sayThis}\n\nVia The Desk — thedeskglobal.manus.space`);
      window.open(LINKEDIN_COMPOSE_URL, "_blank", "noopener,noreferrer");
      toast.success("Copied. LinkedIn open in a new tab — paste in.");
    } catch {
      toast.error("Couldn't open share intent");
    }
  }

  const accent = PERSONA_COLOUR[persona];

  return (
    <div
      className="mt-5 p-4 sm:p-5 rounded relative"
      style={{
        background: `linear-gradient(135deg, ${accent}13 0%, ${accent}06 100%)`,
        border: `1px solid ${accent}33`,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="h-7 w-7 rounded-full shrink-0 flex items-center justify-center"
          style={{
            background: `${accent}22`,
            border: `1px solid ${accent}55`,
          }}
          aria-hidden="true"
        >
          <MessageSquare className="h-3.5 w-3.5" style={{ color: accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="overline mb-1.5"
            style={{ color: accent, letterSpacing: "0.2em" }}
          >
            Say this · {persona}
          </p>
          <p className="font-serif italic text-base sm:text-lg leading-snug text-[var(--color-fg)]">
            "{sayThis}"
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.5 flex-wrap">
        <SmallButton onClick={copyText} icon={copied === "text" ? Check : Copy}>
          {copied === "text" ? "Copied" : "Copy"}
        </SmallButton>
        <SmallButton onClick={share} icon={Linkedin}>Share</SmallButton>
        <SmallButton onClick={copyLink} icon={copied === "link" ? Check : Link2}>
          {copied === "link" ? "Link copied" : "Copy link"}
        </SmallButton>
      </div>
    </div>
  );
}

function SmallButton({
  onClick,
  icon: Icon,
  children,
}: {
  onClick: () => void;
  icon: typeof Copy;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-[0.14em]",
        "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] border border-[var(--color-border)]",
        "hover:border-amber-400/40 hover:bg-white/[0.03] transition-colors"
      )}
    >
      <Icon className="h-3 w-3" />
      {children}
    </button>
  );
}
