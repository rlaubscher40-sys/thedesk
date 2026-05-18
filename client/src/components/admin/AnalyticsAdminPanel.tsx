/**
 * Tiny admin block that surfaces the Plausible dashboard URL so the editor
 * doesn't have to leave the product to check readership. No API integration
 * (Plausible's stats API requires a separate paid tier on the hosted plan,
 * and we don't want to ship the API key client-side anyway), just a
 * one-tap pivot to the dashboard with the domain pre-filled.
 *
 * Hidden entirely when VITE_PLAUSIBLE_DOMAIN isn't configured.
 */
import { BarChart3, ExternalLink } from "lucide-react";

const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;

export function AnalyticsAdminPanel() {
  if (!domain) return null;
  const url = `https://plausible.io/${encodeURIComponent(domain)}`;
  return (
    <section className="panel rounded p-6 sm:p-8 space-y-4">
      <div>
        <p
          className="overline-amber mb-2"
          style={{ letterSpacing: "0.22em", fontSize: "10px" }}
        >
          Analytics
        </p>
        <h2 className="font-serif text-2xl font-bold leading-tight">
          Readers
        </h2>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1.5 max-w-[60ch]">
          Live numbers, visitors, top editions, referrers, sit in your
          Plausible dashboard. One tap.
        </p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded px-4 py-2 text-[10px] font-mono uppercase tracking-[0.18em] transition-all active:scale-[0.98]"
        style={{
          background:
            "var(--grad-cta-amber)",
          color: "var(--color-on-amber)",
        }}
      >
        <BarChart3 className="h-3 w-3" />
        Open Plausible dashboard
        <ExternalLink className="h-3 w-3" />
      </a>
      <p
        className="font-mono text-[10px] text-[var(--color-fg-subtle)]"
        style={{ letterSpacing: "0.14em" }}
      >
        Tracking · {domain}
      </p>
    </section>
  );
}
