import { Check, LineChart, LoaderCircle, Share2 } from "lucide-react";
import { useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { trpc } from "@/lib/trpc";

function base64ToFile(base64: string, mimeType: string, filename: string): File {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mimeType });
}

function metricSurface(): "signals" | "trends" {
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/signals")) return "signals";
  return "trends";
}

export function ShareMetricCardButton({
  metricKey,
  label,
  canChart = false,
}: {
  metricKey: string;
  label: string;
  canChart?: boolean;
}) {
  const [complete, setComplete] = useState<"number" | "chart" | null>(null);
  const numberMutation = trpc.metrics.shareCard.useMutation();
  const chartMutation = trpc.metrics.shareTrendCard.useMutation();

  async function deliver(
    kind: "number" | "chart",
    rendered: { base64: string; mimeType: string; filename: string; sharePath?: string }
  ) {
    const file = base64ToFile(rendered.base64, rendered.mimeType, rendered.filename);
    const publicUrl = rendered.sharePath
      ? new URL(rendered.sharePath, window.location.origin).toString()
      : undefined;
    const title = kind === "chart" ? `The Chart: ${label}` : `The Number: ${label}`;
    const text = `The Desk · ${kind === "chart" ? "The Chart" : "The Number"} · ${label}`;
    const canShareFile = navigator.canShare?.({ files: [file] }) ?? false;

    if (navigator.share) {
      try {
        if (canShareFile) {
          await navigator.share({ files: [file], title, text, ...(publicUrl ? { url: publicUrl } : {}) });
        } else if (publicUrl) {
          await navigator.share({ title, text, url: publicUrl });
        } else {
          throw new Error("File sharing unavailable");
        }
        trackEvent("signal_share", metricSurface());
        setComplete(kind);
        window.setTimeout(() => setComplete(null), 1800);
        return;
      } catch {
        // Cancellation or platform failure falls back to deterministic export.
      }
    }

    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = rendered.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (publicUrl) {
      try {
        await navigator.clipboard.writeText(publicUrl);
      } catch {
        // Asset export is still successful without clipboard permission.
      }
    }
    trackEvent("signal_share", metricSurface());
    setComplete(kind);
    window.setTimeout(() => setComplete(null), 1800);
  }

  async function shareNumber() {
    setComplete(null);
    try {
      const rendered = await numberMutation.mutateAsync({ metricKey });
      await deliver("number", rendered);
    } catch {
      // Mutation error is exposed in the button title.
    }
  }

  async function shareChart() {
    if (!canChart) return;
    setComplete(null);
    try {
      const rendered = await chartMutation.mutateAsync({ metricKey });
      await deliver("chart", rendered);
    } catch {
      // Mutation error is exposed in the button title.
    }
  }

  return (
    <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={() => void shareNumber()}
        disabled={numberMutation.isPending || chartMutation.isPending}
        className="inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.14em] text-[9px] text-[var(--color-fg-subtle)] hover:text-[var(--color-accent-text)] disabled:opacity-40 transition-colors"
        title={numberMutation.error?.message ?? `Share ${label} as The Number`}
        aria-label={`Share ${label} as The Number`}
      >
        {numberMutation.isPending ? (
          <LoaderCircle className="h-3 w-3 animate-spin" />
        ) : complete === "number" ? (
          <Check className="h-3 w-3" />
        ) : (
          <Share2 className="h-3 w-3" />
        )}
        {numberMutation.isPending ? "Building" : complete === "number" ? "Ready" : "The Number"}
      </button>

      {canChart && (
        <button
          type="button"
          onClick={() => void shareChart()}
          disabled={numberMutation.isPending || chartMutation.isPending}
          className="inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.14em] text-[9px] text-[var(--color-fg-subtle)] hover:text-[var(--color-accent-text)] disabled:opacity-40 transition-colors"
          title={chartMutation.error?.message ?? `Share ${label} as The Chart`}
          aria-label={`Share ${label} as The Chart`}
        >
          {chartMutation.isPending ? (
            <LoaderCircle className="h-3 w-3 animate-spin" />
          ) : complete === "chart" ? (
            <Check className="h-3 w-3" />
          ) : (
            <LineChart className="h-3 w-3" />
          )}
          {chartMutation.isPending ? "Building" : complete === "chart" ? "Ready" : "The Chart"}
        </button>
      )}
    </div>
  );
}
