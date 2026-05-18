/**
 * Admin login. There's only one user (Ruben), entering the right password
 * sets a signed session cookie and redirects to /admin. Public visitors
 * never see this page; they get to everything that's public without
 * authenticating.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Lock } from "lucide-react";
import { BrandLockup } from "@/components/Logomark";
import { trpc } from "@/lib/trpc";

export default function Login() {
  const [, navigate] = useLocation();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const utils = trpc.useUtils();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Invalid password");
        return;
      }
      await utils.auth.me.invalidate();
      navigate("/admin");
    } catch (err) {
      setError("Network error, try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto py-16">
      <div className="panel rounded-sm p-8 sm:p-10 space-y-6">
        <BrandLockup size={36} />
        <div>
          <p
            className="overline-amber"
            style={{ letterSpacing: "0.22em", fontSize: "10px" }}
          >
            Curator access
          </p>
          <h1 className="font-serif text-2xl font-bold leading-tight mt-1">
            Sign in
          </h1>
        </div>

        <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed">
          The public site is open to all readers. This page is for the curator
         , sign in to access /admin and any owner-only controls.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-3 rounded-sm text-base bg-black/30 border border-[var(--color-border)] focus:outline-none focus:border-amber-400/40 transition-colors"
            aria-label="Admin password"
          />
          <button
            type="submit"
            disabled={busy || !password}
            className="inline-flex items-center justify-center gap-2 w-full rounded-sm px-4 py-3 text-xs font-mono uppercase tracking-[0.18em] transition-all active:scale-[0.98] disabled:opacity-50 text-[var(--color-on-amber)]"
            style={{
              background: "var(--grad-cta-amber)",
              boxShadow:
                "0 1px 0 oklch(1 0 0 / 18%) inset, 0 4px 14px var(--color-amber-glow)",
            }}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {error && (
          <p
            className="text-xs text-red-300/90 border-l-2 border-red-400/40 pl-3"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
