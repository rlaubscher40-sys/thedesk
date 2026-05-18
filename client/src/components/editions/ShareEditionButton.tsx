/**
 * Share button on the EditionReader. Opens a small popover with three
 * actions:
 *
 *   · Copy link   , copies the canonical /editions/{n} URL
 *   · LinkedIn    , opens LinkedIn's share intent (copies the link +
 *                    opens the composer, since LinkedIn ignores
 *                    ?text= URL params)
 *   · X / Twitter , opens X's tweet intent pre-filled with the
 *                    edition headline + link
 *
 * Drives organic reach, every edition becomes shareable, every
 * shared link routes back into the funnel.
 */
import { useState } from "react";
import { Check, Copy, Linkedin, Share2, Twitter } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import type { Edition } from "@shared/types";

const LINKEDIN_COMPOSE_URL = "https://www.linkedin.com/feed/?shareActive=true";

export function ShareEditionButton({ edition }: { edition: Edition }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const url =
    typeof window === "undefined"
      ? `/editions/${edition.editionNumber}`
      : `${window.location.origin}/editions/${edition.editionNumber}`;
  const tweet = `${edition.weekRange} · Edition ${edition.editionNumber}, weekly intelligence for property partnerships. Via @ruben_laubscher`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  async function shareLinkedIn() {
    try {
      await navigator.clipboard.writeText(`${tweet}\n\n${url}`);
      window.open(LINKEDIN_COMPOSE_URL, "_blank", "noopener,noreferrer");
      toast.success("Copied. LinkedIn composer opened, paste in.");
    } catch {
      toast.error("Couldn't open share intent");
    }
    setOpen(false);
  }

  function shareX() {
    const text = encodeURIComponent(tweet);
    const u = encodeURIComponent(url);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${u}`,
      "_blank",
      "noopener,noreferrer"
    );
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-2 rounded-sm px-3 py-1.5 border text-xs font-mono uppercase tracking-[0.16em] transition-colors",
          open
            ? "border-amber-400/50 text-[var(--color-fg)] bg-amber-500/10"
            : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)]"
        )}
      >
        <Share2 className="h-3.5 w-3.5" />
        Share
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            className="absolute right-0 top-full mt-2 z-40 w-56 panel rounded-sm py-1.5 shadow-xl"
            style={{ background: "var(--color-panel-tile-bg)" }}
          >
            <MenuItem onClick={copyLink} icon={copied ? Check : Copy}>
              {copied ? "Link copied" : "Copy link"}
            </MenuItem>
            <MenuItem onClick={shareLinkedIn} icon={Linkedin}>
              Share on LinkedIn
            </MenuItem>
            <MenuItem onClick={shareX} icon={Twitter}>
              Share on X
            </MenuItem>
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
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
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-white/[0.04] transition-colors"
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {children}
    </button>
  );
}
