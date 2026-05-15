/**
 * Subscribe rail card — email + Subscribe button. Stubbed: shows a toast
 * on submit, doesn't actually send the address anywhere.
 */
import { useState } from "react";
import { toast } from "sonner";
import { RailPanel } from "./RailPanel";

export function Subscribe() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!ok) {
      toast.error("That email doesn't look right");
      return;
    }
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setEmail("");
      toast.success("You're on the list", {
        description: "In production this would post to the subscriber endpoint.",
      });
    }, 600);
  }

  return (
    <RailPanel overline="Subscribe">
      <p className="text-sm text-[var(--color-fg-muted)] mb-4 leading-relaxed">
        Get the Daily Brief and the weekly edition in your inbox at 7am AEST.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@firm.com"
          className="px-3 py-2 rounded text-sm bg-black/20 border border-[var(--color-border)] focus:outline-none focus:border-amber-400/40 transition-colors"
          aria-label="Email address"
        />
        <button
          type="submit"
          disabled={busy}
          className="px-3.5 py-2 rounded text-xs font-mono uppercase tracking-[0.18em] transition-all active:scale-[0.98] disabled:opacity-50"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.78 0.18 70) 0%, oklch(0.88 0.19 82) 50%, oklch(0.68 0.16 60) 100%)",
            color: "oklch(0.10 0.018 260)",
            boxShadow: "0 4px 16px oklch(0.75 0.18 70 / 25%)",
          }}
        >
          {busy ? "Subscribing…" : "Subscribe"}
        </button>
      </form>
    </RailPanel>
  );
}
