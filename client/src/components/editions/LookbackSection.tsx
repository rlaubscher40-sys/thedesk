/**
 * "Last week, in review" — the accountability section. Renders the edition's
 * look-back: how last week's forward-looking calls actually played out, each
 * with an honest verdict chip. This is the trust-builder, so the verdicts are
 * colour-coded plainly, including "missed", rather than hidden.
 */
import type { Lookback, LookbackItem } from "@shared/schemas";

const VERDICT: Record<
  LookbackItem["verdict"],
  { label: string; colour: string }
> = {
  "played-out": { label: "Played out", colour: "oklch(0.72 0.17 155)" }, // green
  "on-track": { label: "On track", colour: "oklch(0.78 0.18 70)" }, // amber
  "too-early": { label: "Too early", colour: "oklch(0.70 0.06 250)" }, // slate
  missed: { label: "Missed", colour: "oklch(0.68 0.20 15)" }, // red
};

export function LookbackSection({ lookback }: { lookback: Lookback }) {
  if (!lookback || lookback.items.length === 0) return null;
  return (
    <section className="mt-12">
      <div className="mb-5 flex items-center gap-3">
        <p className="overline-amber" style={{ letterSpacing: "0.22em" }}>
          Last week, in review
        </p>
        <span
          className="block flex-1 h-px bg-[var(--color-border)]"
          aria-hidden="true"
        />
      </div>

      {lookback.summary && (
        <p className="font-serif italic text-[var(--color-fg-muted)] leading-relaxed mb-6 max-w-[68ch]">
          {lookback.summary}
        </p>
      )}

      <ul className="space-y-3">
        {lookback.items.map((item, idx) => {
          const v = VERDICT[item.verdict] ?? VERDICT["on-track"];
          return (
            <li
              key={`lookback-${idx}-${item.reference.slice(0, 24)}`}
              className="panel rounded-sm p-4 sm:p-5"
              style={{ boxShadow: `inset 2px 0 0 ${v.colour}` }}
            >
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <p className="text-[13px] text-[var(--color-fg-subtle)] leading-relaxed min-w-0">
                  We flagged: {item.reference}
                </p>
                <span
                  className="font-mono uppercase shrink-0 rounded-sm px-1.5 py-0.5"
                  style={{
                    color: v.colour,
                    border: `1px solid ${v.colour}`,
                    fontSize: "9.5px",
                    letterSpacing: "0.14em",
                  }}
                >
                  {v.label}
                </span>
              </div>
              <p className="text-sm text-[var(--color-fg)] leading-relaxed">
                {item.outcome}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
