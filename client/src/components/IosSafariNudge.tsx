import { useState } from "react";
import { Share2, X } from "lucide-react";

const DISMISSED_KEY = "thedesk:ios-safari-nudge-dismissed";

function shouldShow(): boolean {
  if (typeof window === "undefined") return false;
  // Already installed as a PWA — no nudge needed
  if ((window.navigator as Navigator & { standalone?: boolean }).standalone) return false;
  // Already dismissed
  if (localStorage.getItem(DISMISSED_KEY)) return false;

  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  if (!isIos) return false;

  // These tokens appear in third-party browser UAs on iOS; Safari has none of them
  const isNonSafariBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|GSA/i.test(ua);
  return isNonSafariBrowser;
}

export function IosSafariNudge() {
  const [visible, setVisible] = useState(() => shouldShow());

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
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
      <p className="flex-1 text-[13px] leading-snug text-[var(--color-fg-muted)]">
        To install The Desk on your home screen, open this page in{" "}
        <span className="text-amber-300 font-medium">Safari</span>, then tap{" "}
        <span className="text-amber-300 font-medium">Share → Add to Home Screen</span>.
      </p>
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
