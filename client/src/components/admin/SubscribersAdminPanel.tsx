/**
 * Admin view of the subscriber list. Read-only for now, until email
 * delivery is wired, this is just the "who's signed up" surface.
 */
import { Mail } from "lucide-react";
import { trpc } from "@/lib/trpc";

export function SubscribersAdminPanel() {
  const listQuery = trpc.subscribers.list.useQuery();
  const countQuery = trpc.subscribers.count.useQuery();

  const subs = listQuery.data ?? [];
  const total = countQuery.data?.count ?? 0;
  const confirmed = subs.filter((s) => s.confirmedAt && !s.unsubscribedAt).length;
  const pending = subs.filter((s) => !s.confirmedAt && !s.unsubscribedAt).length;
  const unsubscribed = subs.filter((s) => s.unsubscribedAt).length;

  return (
    <section className="panel rounded p-6 sm:p-8 space-y-6">
      <div>
        <p
          className="overline-amber mb-2"
          style={{ letterSpacing: "0.22em", fontSize: "10px" }}
        >
          Audience
        </p>
        <h2 className="font-serif text-2xl font-bold leading-tight">Subscribers</h2>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1.5 max-w-[60ch]">
          Everyone who's filled in a subscribe form. Confirmation emails
          send through Resend the moment the form posts; the row flips
          to confirmed when the recipient clicks the link.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px panel rounded overflow-hidden">
        <Stat label="Total" value={total} />
        <Stat label="Confirmed" value={confirmed} accent="oklch(0.72 0.17 155)" />
        <Stat label="Pending" value={pending} accent="oklch(0.78 0.18 70)" />
        <Stat label="Unsubscribed" value={unsubscribed} accent="oklch(0.68 0.20 15)" />
      </div>

      {subs.length === 0 ? (
        <div className="panel p-6 rounded text-sm text-[var(--color-fg-muted)]">
          No subscribers yet.
        </div>
      ) : (
        <div className="panel rounded overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_120px_120px_100px] items-center gap-4 px-5 py-3 border-b border-[var(--color-border)] overline">
            <span>Email</span>
            <span>Source</span>
            <span>Status</span>
            <span className="text-right">Signed up</span>
          </div>
          <ul>
            {subs.map((s) => (
              <li
                key={s.id}
                className="grid grid-cols-[minmax(0,1fr)_120px_120px_100px] items-center gap-4 px-5 py-3 text-sm border-b border-[var(--color-border)] last:border-b-0 hover:bg-white/[0.02]"
              >
                <span className="font-mono text-[13px] truncate">{s.email}</span>
                <span className="text-[var(--color-fg-muted)] truncate">
                  {s.source ?? "—"}
                </span>
                <span>
                  {s.unsubscribedAt ? (
                    <Badge label="Unsub'd" colour="oklch(0.68 0.20 15)" />
                  ) : s.confirmedAt ? (
                    <Badge label="Confirmed" colour="oklch(0.72 0.17 155)" />
                  ) : (
                    <Badge label="Pending" colour="oklch(0.78 0.18 70)" />
                  )}
                </span>
                <span className="font-mono text-[11px] text-[var(--color-fg-subtle)] text-right">
                  {new Date(s.createdAt).toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  accent = "var(--color-fg-muted)",
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="bg-[var(--color-bg-elevated)] p-5">
      <div className="flex items-center justify-between mb-3">
        <p
          className="overline truncate"
          style={{ letterSpacing: "0.16em" }}
        >
          {label}
        </p>
        <Mail className="h-3 w-3" style={{ color: accent }} />
      </div>
      <p
        className="font-serif text-3xl font-bold tabular-nums leading-none"
        style={{ color: accent }}
      >
        {value}
      </p>
    </div>
  );
}

function Badge({ label, colour }: { label: string; colour: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono uppercase text-[10px] tracking-[0.16em]"
      style={{ color: colour }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: colour }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
