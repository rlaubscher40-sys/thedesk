/**
 * Soft paywall hint for stories tagged `tier: "paid"`. Doesn't actually
 * hide content in demo mode — it just signals which items are
 * paid-tier and routes the user to subscribe.
 *
 * Hidden entirely once the signed-in user has `isPremium: true`, so paid
 * subscribers see the full card without the upsell rail.
 */
import { Lock } from "lucide-react";
import { useAuth } from "@/lib/useAuth";

const SUBSCRIBE_URL = "https://rubenlaubscher.substack.com/";

export function PaywallHint() {
  const { user } = useAuth();
  if (user?.isPremium) return null;
  return (
    <div
      className="mt-5 p-4 rounded-sm flex items-center justify-between gap-3 flex-wrap"
      style={{
        background:
          "linear-gradient(135deg, oklch(0.78 0.18 70 / 8%), oklch(0.78 0.18 70 / 3%))",
        boxShadow: "inset 0 0 0 1px oklch(0.75 0.18 70 / 24%)",
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="h-7 w-7 rounded-full shrink-0 flex items-center justify-center"
          style={{
            background: "oklch(0.75 0.18 70 / 14%)",
            boxShadow: "inset 0 0 0 1px oklch(0.75 0.18 70 / 30%)",
          }}
          aria-hidden="true"
        >
          <Lock className="h-3.5 w-3.5 text-amber-300" />
        </span>
        <div className="min-w-0">
          <p
            className="overline-amber"
            style={{ letterSpacing: "0.22em", fontSize: "10px" }}
          >
            Subscribers · Paid tier
          </p>
          <p className="text-xs text-[var(--color-fg-muted)] mt-1">
            Full talking points and analyst note for paid subscribers.
          </p>
        </div>
      </div>
      <a
        href={SUBSCRIBE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.18em] shrink-0 transition-all active:scale-[0.98]"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.78 0.18 70) 0%, oklch(0.88 0.19 82) 55%, oklch(0.65 0.16 60) 100%)",
          color: "oklch(0.10 0.018 260)",
          boxShadow:
            "0 1px 0 oklch(1 0 0 / 18%) inset, 0 4px 14px oklch(0.75 0.18 70 / 25%)",
        }}
      >
        Subscribe to unlock
      </a>
    </div>
  );
}
