/**
 * Subscribe rail card — email + Subscribe button. Posts to the
 * `subscribers.subscribe` tRPC mutation (double-opt-in: a confirm token is
 * returned which would normally arrive by email). Falls back to a toast on
 * server error so the rail never breaks the page.
 */
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { RailPanel } from "./RailPanel";

export function Subscribe({ source = "right-rail" }: { source?: string }) {
  const [email, setEmail] = useState("");
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
      toast.error("Couldn't subscribe right now — try again in a minute.");
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!ok) {
      toast.error("That email doesn't look right");
      return;
    }
    subscribe.mutate({ email, source });
  }

  const busy = subscribe.isPending;

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
