/**
 * Subscribe rail card, email + Subscribe button. Posts to the
 * `subscribers.subscribe` tRPC mutation (double-opt-in: a confirm token is
 * returned which would normally arrive by email). Falls back to a toast on
 * server error so the rail never breaks the page.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Honeypot } from "@/components/Honeypot";
import { trpc } from "@/lib/trpc";
import { RailPanel } from "./RailPanel";

export function Subscribe({ source = "right-rail" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const subscribe = trpc.subscribers.subscribe.useMutation({
    onSuccess: (res) => {
      setEmail("");
      if (res.status === "already-confirmed") {
        toast.success("You're already on the list");
      } else {
        toast.success("Check your inbox", {
          description: "Confirm the email to lock in your subscription.",
        });
      }
    },
    onError: () => {
      toast.error("Couldn't subscribe right now, try again in a minute.");
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!ok) {
      toast.error("That email doesn't look right");
      return;
    }
    subscribe.mutate({ email, source, _hp: hp });
  }

  const busy = subscribe.isPending;

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
          className="px-3 py-2 rounded text-sm bg-black/20 border border-[var(--color-border)] focus:outline-none focus:border-amber-400/40 transition-colors"
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
