/**
 * Subscribe rail card, email + Subscribe button. All the mutation wiring
 * (validation, honeypot, uniform success/error copy) lives in the shared
 * useSubscribe hook so every subscribe surface behaves identically.
 * Hidden once this device has already subscribed — no point pitching a
 * reader who's on the list.
 */
import { useState } from "react";
import { Honeypot } from "@/components/Honeypot";
import { hasSubscribed, useSubscribe } from "@/lib/useSubscribe";
import { RailPanel } from "./RailPanel";

export function Subscribe({ source = "right-rail" }: { source?: string }) {
  // Read once on mount: hiding mid-session right after a subscribe would
  // yank the panel out from under the success toast.
  const [alreadySubscribed] = useState(hasSubscribed);
  const { email, setEmail, hp, setHp, submit: onSubmit, busy } = useSubscribe({ source });

  if (alreadySubscribed) return null;

  return (
    <RailPanel overline="Subscribe">
      <p className="text-sm text-[var(--color-fg-muted)] mb-4 leading-relaxed">
        Get the Daily Brief and the weekly edition in your inbox at 7am AEST.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
        <Honeypot value={hp} onChange={setHp} />
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@firm.com"
          className="px-3 py-2 rounded text-sm bg-[var(--color-bg-deep)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-amber)]/50 transition-colors"
          aria-label="Email address"
        />
        <button
          type="submit"
          disabled={busy}
          className="px-3.5 py-2 rounded text-xs font-mono uppercase tracking-[0.18em] transition-all active:scale-[0.98] disabled:opacity-50 text-[var(--color-on-amber)]"
          style={{
            background: "var(--grad-cta-amber)",
            boxShadow: "0 4px 16px var(--color-amber-glow)",
          }}
        >
          {busy ? "Subscribing…" : "Subscribe"}
        </button>
      </form>
    </RailPanel>
  );
}
