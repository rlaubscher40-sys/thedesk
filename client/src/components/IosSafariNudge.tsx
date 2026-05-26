import { useState } from "react";
import { Share2, X } from "lucide-react";

const DISMISSED_KEY = "thedesk:ios-safari-nudge-dismissed";

type NudgeVariant = "switch-to-safari" | "add-to-home-screen" | null;

function detectVariant(): NudgeVariant {
  if (typeof window === "undefined") return null;
  // Already installed as a PWA — no nudge needed
  if ((window.navigator as Navigator & { standalone?: boolean }).standalone) return null;
  // Already dismissed
  if (localStorage.getItem(DISMISSED_KEY)) return null;

  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  if (!isIos) return null;

  // Third-party browsers on iOS (Chrome, Firefox, Edge, Opera, Google app)
  const isNonSafariBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|GSA/i.test(ua);
  if (isNonSafariBrowser) return "switch-to-safari";

  // Safari on iOS — no automatic install banner, user needs the manual prompt
  return "add-to-home-screen";
}

export function IosSafariNudge() {
  const [variant, setVariant] = useState<NudgeVariant>(() => detectVariant());

  if (!variant) return null;

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVariant(null);
  }

  return (
    <div
      role="status"
      className="fixed bottom-20 inset-x-4 z-50 flex items-start gap-3 rounded-sm px-4 py-3 text-sm"
      style={{
        background: "var(--color-banner-bg, oklch(0.18 0.02 260 / 0.96))",
        backdropFilter: "blur(8px)",
        boxShadow: "inset 0 0 0 1px oklch(0.78 0.18 70 / 28%), 0 8px 32px oklch(0 0 0 / 0.5)",
        color: "var(--color-fg)",
      }}
    >
      <Share2 className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
      {variant === "add-to-home-screen" ? (
        <p className="flex-1 text-[13px] leading-snug text-[var(--color-fg-muted)]">
          Install The Desk: tap the{" "}
          <span className="text-amber-300 font-medium">Share</span> button below, then{" "}
          <span className="text-amber-300 font-medium">Add to Home Screen</span>.
        </p>
      ) : (
        <p className="flex-1 text-[13px] leading-snug text-[var(--color-fg-muted)]">
          To install The Desk, open this page in{" "}
          <span className="text-amber-300 font-medium">Safari</span>, then tap{" "}
          <span className="text-amber-300 font-medium">Share → Add to Home Screen</span>.
        </p>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 p-0.5 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
