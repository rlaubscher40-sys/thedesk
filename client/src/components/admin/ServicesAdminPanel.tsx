/**
 * Service dependencies panel.
 *
 * A catalogue of every third-party service the site relies on — database,
 * hosting, network, AI, email, social, automation — with a status for each
 * and a one-click link out to the provider's own status page.
 *
 * Status comes from trpc.health.services: live where the app can verify it
 * cheaply (DB ping, Railway/Cloudflare runtime signals), configuration-state
 * for the paid external APIs (we don't burn a request per poll). Polls every
 * 60s while visible.
 */
import { ExternalLink, RefreshCw, Server } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/Skeleton";

type ServiceState =
  | "operational"
  | "configured"
  | "not_configured"
  | "down"
  | "info";

const STATE_LABEL: Record<ServiceState, string> = {
  operational: "Operational",
  configured: "Configured",
  not_configured: "Not configured",
  down: "Down",
  info: "Unverified",
};

/** Pick a colour for a state, escalating a missing *required* service to red. */
function stateColour(state: ServiceState, required: boolean): string {
  switch (state) {
    case "operational":
      return "oklch(0.72 0.17 155)"; // green
    case "configured":
      return "oklch(0.80 0.15 85)"; // amber
    case "down":
      return "oklch(0.65 0.21 20)"; // red
    case "not_configured":
      return required ? "oklch(0.65 0.21 20)" : "var(--color-fg-subtle)";
    case "info":
    default:
      return "var(--color-fg-subtle)";
  }
}

export function ServicesAdminPanel() {
  const servicesQuery = trpc.health.services.useQuery(undefined, {
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const utils = trpc.useUtils();

  const data = servicesQuery.data;
  const services = data?.services ?? [];

  // Stable category order, anything unexpected falls to the end.
  const order = ["Data", "Hosting & network", "AI", "Email", "Social", "Automation"];
  const categories = Array.from(new Set(services.map((s) => s.category))).sort(
    (a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    }
  );

  const healthy = services.filter(
    (s) => s.state === "operational" || s.state === "configured"
  ).length;
  const attention = services.filter(
    (s) => s.state === "down" || (s.state === "not_configured" && s.required)
  ).length;

  return (
    <section className="panel rounded p-6 sm:p-8 space-y-7">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p
            className="overline-amber mb-2"
            style={{ letterSpacing: "0.22em", fontSize: "10px" }}
          >
            Dependencies
          </p>
          <h2 className="font-serif text-2xl font-bold leading-tight flex items-center gap-2">
            <Server className="h-5 w-5 text-[var(--color-fg-muted)]" />
            Services we rely on
          </h2>
          <p className="text-sm text-[var(--color-fg-muted)] mt-1.5 max-w-[64ch]">
            Every external service the site depends on, and its status. Live
            where we can check it cheaply; otherwise the credential state, with
            a link out to the provider's status page. Polls every 60 seconds.
          </p>
        </div>
        <button
          onClick={() => {
            utils.health.services.invalidate();
            toast.message("Refreshed");
          }}
          className="inline-flex items-center gap-1.5 rounded px-3 py-2 text-[10px] font-mono uppercase tracking-[0.18em] border border-[var(--color-border)] hover:border-[var(--color-amber)]/40 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </header>

      {servicesQuery.isLoading ? (
        <Skeleton className="h-64 w-full rounded" />
      ) : (
        <>
          {/* Summary line */}
          <div className="flex items-center gap-5 text-[11px] font-mono uppercase tracking-[0.16em]">
            <span style={{ color: "oklch(0.72 0.17 155)" }}>
              {healthy} of {services.length} healthy
            </span>
            {attention > 0 && (
              <span style={{ color: "oklch(0.65 0.21 20)" }}>
                {attention} need attention
              </span>
            )}
          </div>

          <div className="space-y-7">
            {categories.map((cat) => (
              <div key={cat}>
                <p
                  className="overline mb-2.5"
                  style={{ letterSpacing: "0.16em" }}
                >
                  {cat}
                </p>
                <ul className="panel rounded overflow-hidden">
                  {services
                    .filter((s) => s.category === cat)
                    .map((s) => {
                      const colour = stateColour(s.state, s.required);
                      return (
                        <li
                          key={s.id}
                          className="flex items-start gap-4 px-5 py-4 border-b border-[var(--color-border)] last:border-b-0"
                        >
                          {/* Status dot */}
                          <span
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                            style={{ background: colour }}
                            aria-hidden="true"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-serif text-[15px] font-semibold">
                                {s.name}
                              </span>
                              {s.required && (
                                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)] border border-[var(--color-border)] rounded px-1.5 py-0.5">
                                  Required
                                </span>
                              )}
                            </div>
                            <p className="text-[13px] text-[var(--color-fg-muted)] mt-1 leading-snug">
                              {s.role}
                            </p>
                            <p className="text-[12px] text-[var(--color-fg-subtle)] mt-1 font-mono">
                              {s.detail}
                            </p>
                            <div className="flex items-center gap-4 mt-2">
                              <a
                                href={s.statusUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.16em] overline-amber hover:text-amber-200 transition-colors"
                              >
                                Status
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                              {s.dashboardUrl && (
                                <a
                                  href={s.dashboardUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
                                >
                                  Dashboard
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              )}
                            </div>
                          </div>
                          {/* State label */}
                          <span
                            className="shrink-0 inline-flex items-center font-mono uppercase text-[10px] tracking-[0.16em] whitespace-nowrap"
                            style={{ color: colour }}
                          >
                            {STATE_LABEL[s.state]}
                          </span>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
