/**
 * Key Metrics rail card — 2×2 grid of mono key + serif value tiles. Each
 * tile has its own faint top-rule for editorial density.
 */
import { metrics, editionMeta } from "@/data/editions/2026-05-15";
import { RailPanel } from "./RailPanel";

export function KeyMetrics() {
  return (
    <RailPanel
      overline="Key metrics · vs prior"
      footer={`Edition ${editionMeta.number} · ${editionMeta.date}`}
    >
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded bg-[var(--color-border)]">
        {metrics.map((m) => (
          <div
            key={m.key}
            className="bg-[var(--color-bg-elevated)] p-3.5 relative"
          >
            <p
              className="overline mb-2 truncate"
              style={{ fontSize: "9px", letterSpacing: "0.16em" }}
            >
              {m.key}
            </p>
            <p className="font-serif text-base font-semibold tabular-nums text-[var(--color-fg)] leading-tight">
              {m.value}
            </p>
            {m.detail && (
              <p
                className="font-mono text-[10px] text-[var(--color-fg-subtle)] mt-1.5 truncate"
                title={m.detail}
              >
                {m.detail}
              </p>
            )}
          </div>
        ))}
      </div>
    </RailPanel>
  );
}
