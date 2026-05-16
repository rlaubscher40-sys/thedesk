/**
 * Admin panel for the daily metrics strip. Lets the editor add or override
 * any metric — useful for AU-specific data the automated ingest doesn't
 * yet cover (CPI, unemployment, auction clearance, listings volume).
 *
 * Form is intentionally generic: any metricKey/label/value/unit combo.
 * Lower displayOrder = appears earlier on the strip.
 */
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export function MetricsAdminPanel() {
  const utils = trpc.useUtils();
  const listQuery = trpc.metrics.listAll.useQuery();

  const [metricKey, setMetricKey] = useState("");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [context, setContext] = useState("");
  const [groupKey, setGroupKey] = useState("MACRO");
  const [displayOrder, setDisplayOrder] = useState("100");

  const upsert = trpc.metrics.upsert.useMutation({
    onSuccess: () => {
      toast.success("Metric saved");
      setMetricKey("");
      setLabel("");
      setValue("");
      setUnit("");
      setContext("");
      setDisplayOrder("100");
      utils.metrics.list.invalidate();
      utils.metrics.listAll.invalidate();
    },
    onError: (err) => toast.error(err.message || "Couldn't save"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!metricKey.trim() || !label.trim() || !value.trim()) {
      toast.error("Key, label, and value are all required");
      return;
    }
    upsert.mutate({
      metricKey: metricKey.trim(),
      label: label.trim(),
      value: value.trim(),
      unit: unit.trim() || null,
      context: context.trim() || null,
      groupKey: groupKey.trim() || null,
      displayOrder: Number(displayOrder) || 100,
    });
  }

  const metrics = listQuery.data ?? [];

  return (
    <section className="panel rounded p-6 sm:p-8 space-y-6">
      <div>
        <p
          className="overline-amber mb-2"
          style={{ letterSpacing: "0.22em", fontSize: "10px" }}
        >
          Key metrics
        </p>
        <h2 className="font-serif text-2xl font-bold leading-tight">Metrics strip</h2>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1.5 max-w-[60ch]">
          Add or update any metric. Reuse an existing key (like
          <code className="font-mono mx-1 px-1 bg-black/30 rounded">cash_rate</code>)
          to override the automated daily ingest. Or add new ones for things
          the ingest doesn't cover yet (CPI, unemployment, auction clearance).
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-3">
          <div>
            <label
              className="overline block mb-1.5"
              style={{ letterSpacing: "0.18em", fontSize: "10px" }}
            >
              Metric key
            </label>
            <input
              type="text"
              value={metricKey}
              onChange={(e) => setMetricKey(e.target.value)}
              placeholder="cpi_yoy"
              required
              className="w-full px-3 py-2 rounded text-sm font-mono bg-black/20 border border-[var(--color-border)] focus:outline-none focus:border-amber-400/40 transition-colors"
            />
          </div>
          <div>
            <label
              className="overline block mb-1.5"
              style={{ letterSpacing: "0.18em", fontSize: "10px" }}
            >
              Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="CPI YoY"
              required
              className="w-full px-3 py-2 rounded text-sm bg-black/20 border border-[var(--color-border)] focus:outline-none focus:border-amber-400/40 transition-colors"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label
              className="overline block mb-1.5"
              style={{ letterSpacing: "0.18em", fontSize: "10px" }}
            >
              Value
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="3.4"
              required
              className="w-full px-3 py-2 rounded text-sm tabular-nums bg-black/20 border border-[var(--color-border)] focus:outline-none focus:border-amber-400/40 transition-colors"
            />
          </div>
          <div>
            <label
              className="overline block mb-1.5"
              style={{ letterSpacing: "0.18em", fontSize: "10px" }}
            >
              Unit
            </label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="%"
              className="w-full px-3 py-2 rounded text-sm bg-black/20 border border-[var(--color-border)] focus:outline-none focus:border-amber-400/40 transition-colors"
            />
          </div>
          <div>
            <label
              className="overline block mb-1.5"
              style={{ letterSpacing: "0.18em", fontSize: "10px" }}
            >
              Order
            </label>
            <input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              min={0}
              max={9999}
              className="w-full px-3 py-2 rounded text-sm tabular-nums bg-black/20 border border-[var(--color-border)] focus:outline-none focus:border-amber-400/40 transition-colors"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-3">
          <div>
            <label
              className="overline block mb-1.5"
              style={{ letterSpacing: "0.18em", fontSize: "10px" }}
            >
              Context (one-line blurb under the tile)
            </label>
            <input
              type="text"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              maxLength={256}
              placeholder="ANZ now expects extended hold"
              className="w-full px-3 py-2 rounded text-sm bg-black/20 border border-[var(--color-border)] focus:outline-none focus:border-amber-400/40 transition-colors"
            />
          </div>
          <div>
            <label
              className="overline block mb-1.5"
              style={{ letterSpacing: "0.18em", fontSize: "10px" }}
            >
              Group
            </label>
            <select
              value={groupKey}
              onChange={(e) => setGroupKey(e.target.value)}
              className="w-full px-3 py-2 rounded text-sm bg-black/20 border border-[var(--color-border)] focus:outline-none focus:border-amber-400/40 transition-colors"
            >
              <option value="MACRO">Macro & rates</option>
              <option value="PROPERTY">Property</option>
              <option value="LABOUR">Labour & wages</option>
              <option value="MARKETS">Markets</option>
              <option value="DEMOGRAPHICS">Demographics</option>
              <option value="">— Ungrouped</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={upsert.isPending}
          className="inline-flex items-center gap-1.5 rounded px-3.5 py-2 text-[10px] font-mono uppercase tracking-[0.18em] transition-all active:scale-[0.98] disabled:opacity-50"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.78 0.18 70) 0%, oklch(0.88 0.19 82) 55%, oklch(0.65 0.16 60) 100%)",
            color: "oklch(0.10 0.018 260)",
          }}
        >
          <Plus className="h-3 w-3" />
          {upsert.isPending ? "Saving…" : "Add / update"}
        </button>
      </form>

      <div className="border-t border-[var(--color-border)] pt-5">
        <p className="overline mb-3" style={{ letterSpacing: "0.18em" }}>
          {metrics.length === 0 ? "No metrics yet" : `${metrics.length} live`}
        </p>
        {metrics.length > 0 && (
          <ul className="space-y-2">
            {metrics.map((m) => (
              <li
                key={m.id}
                className="grid grid-cols-[48px_minmax(0,1fr)_120px_100px] items-center gap-4 p-3 rounded bg-black/20 border border-[var(--color-border)]"
              >
                <span className="font-mono tabular-nums text-[var(--color-fg-subtle)] text-xs">
                  {m.displayOrder}
                </span>
                <div className="min-w-0">
                  <p className="text-sm truncate">
                    {m.label}{" "}
                    <span className="text-[var(--color-fg-subtle)] font-mono text-xs">
                      ({m.metricKey})
                    </span>
                  </p>
                  {m.source && (
                    <p className="overline text-[var(--color-fg-subtle)] mt-0.5">
                      {m.source}
                    </p>
                  )}
                </div>
                <span className="font-serif text-base tabular-nums text-right">
                  {m.value}
                  {m.unit ?? ""}
                </span>
                <span className="font-mono text-[10px] text-[var(--color-fg-subtle)] text-right">
                  {new Date(m.updatedAt).toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
