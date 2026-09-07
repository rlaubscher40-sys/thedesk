import { Check, LoaderCircle, Share2 } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

function base64ToFile(base64: string, mimeType: string, filename: string): File {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mimeType });
}

export function ShareMetricCardButton({
  metricKey,
  label,
}: {
  metricKey: string;
  label: string;
}) {
  const [complete, setComplete] = useState(false);
  const mutation = trpc.metrics.shareCard.useMutation();

  async function share() {
    setComplete(false);
    try {
      const rendered = await mutation.mutateAsync({ metricKey });
      const file = base64ToFile(rendered.base64, rendered.mimeType, rendered.filename);
      const canShareFile = navigator.canShare?.({ files: [file] }) ?? false;

      if (navigator.share && canShareFile) {
        try {
          await navigator.share({
            files: [file],
            title: `The Number: ${label}`,
            text: `The Desk · The Number · ${label}`,
          });
          setComplete(true);
          window.setTimeout(() => setComplete(false), 1800);
          return;
        } catch {
          // Cancellation or platform failure falls back to an asset download.
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
      setComplete(true);
      window.setTimeout(() => setComplete(false), 1800);
    } catch {
      // The mutation's error is exposed via the title below; don't throw into
      // the metric grid and take the whole trends surface down.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      disabled={mutation.isPending}
      className="inline-flex items-center gap-1.5 font-mono uppercase tracking-[0.14em] text-[9px] text-[var(--color-fg-subtle)] hover:text-[var(--color-accent-text)] disabled:opacity-40 transition-colors"
      title={mutation.error?.message ?? `Share ${label} as The Number`}
      aria-label={`Share ${label} as The Number`}
    >
      {mutation.isPending ? (
        <LoaderCircle className="h-3 w-3 animate-spin" />
      ) : complete ? (
        <Check className="h-3 w-3" />
      ) : (
        <Share2 className="h-3 w-3" />
      )}
      {mutation.isPending ? "Building" : complete ? "Ready" : "The Number"}
    </button>
  );
}
