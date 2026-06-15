/**
 * SAY THIS quote block, the editorial moment on each card.
 *
 * Renders the active persona's Say This line in italic serif inside a
 * tinted panel. Three actions sit below: Copy, Share (opens LinkedIn
 * compose, copies text first), Copy link (copies the source URL).
 *
 * Each action shows a 2-second toast on success, the toast layer is
 * announced via role="status" by sonner so screen readers pick it up.
 */
import { useState } from "react";
import { Check, Copy, Link2, MessageSquare } from "lucide-react";
import { Linkedin } from "@/components/icons/BrandIcons";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { PERSONA_COLOUR } from "@/lib/persona";
import { SITE_DISPLAY } from "@/lib/siteUrl";
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

  async function copyText() {
    try {
      await navigator.clipboard.writeText(sayThis);
      setCopied("text");
      toast.success("Copied");
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
      await navigator.clipboard.writeText(`${sayThis}\n\nVia The Desk · ${SITE_DISPLAY}`);
      window.open(LINKEDIN_COMPOSE_URL, "_blank", "noopener,noreferrer");
      toast.success("Copied. LinkedIn open in a new tab, paste in.");
    } catch {
      toast.error("Couldn't open share intent");
    }
  }

  const accent = PERSONA_COLOUR[persona];

  return (
    <div
      className="mt-7 p-5 sm:p-6 rounded-sm relative"
      style={{
        background: `linear-gradient(135deg, ${accent}0d 0%, ${accent}04 100%)`,
        boxShadow: `inset 0 0 0 1px ${accent}22`,
      }}
    >
      <div className="flex items-start gap-4">
        <span
          className="h-1 w-6 rounded-full mt-3 shrink-0"
          style={{ background: accent }}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-3 w-3" style={{ color: accent }} />
            <p
              className="overline"
              style={{ color: accent, letterSpacing: "0.24em", fontSize: "10px" }}
            >
              Say this · {persona}
            </p>
          </div>
          <p className="font-serif italic text-lg sm:text-xl leading-snug text-[var(--color-fg)] max-w-[60ch]">
            "{sayThis}"
          </p>
        </div>
      </div>

      <div className="mt-5 ml-10 flex items-center gap-1.5 flex-wrap">
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
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] font-mono uppercase tracking-[0.16em]",
        "text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]",
        "hover:bg-white/[0.04] transition-colors"
      )}
    >
      <Icon className="h-3 w-3" />
      {children}
    </button>
  );
}
