import { Check, LoaderCircle, Share2 } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

type Props = {
  metricKey: string;
};

function base64ToFile(base64: string, mimeType: string, filename: string): File {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mimeType });
}

export function ShareSignalCardButton({ metricKey }: Props) {
  const [complete, setComplete] = useState(false);
  const card = trpc.signals.shareCard.useMutation();

  async function share() {
    setComplete(false);
    const rendered = await card.mutateAsync({ metricKey });
    const file = base64ToFile(rendered.base64, rendered.mimeType, rendered.filename);
    const publicUrl = new URL(rendered.sharePath, window.location.origin).toString();

    if (navigator.share) {
      try {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `${rendered.value} · ${rendered.label}`,
            text: "The Number from The Desk",
            url: publicUrl,
          });
        } else {
          await navigator.share({
            title: `${rendered.value} · ${rendered.label}`,
            text: "The Number from The Desk",
            url: publicUrl,
          });
        }
        setComplete(true);
        window.setTimeout(() => setComplete(false), 2200);
        return;
      } catch {
        // Fall through to deterministic browser export.
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

    try {
      await navigator.clipboard.writeText(publicUrl);
    } catch {
      // Image export still succeeds if Clipboard API is unavailable.
    }

    setComplete(true);
    window.setTimeout(() => setComplete(false), 2200);
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      disabled={card.isPending}
      title={card.error?.message}
      className="bs-btn bs-btn-solid inline-flex items-center gap-2 disabled:opacity-50"
    >
      {card.isPending ? (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      ) : complete ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Share2 className="h-3.5 w-3.5" />
      )}
      {card.isPending ? "Building The Number" : complete ? "Share ready" : "Share The Number"}
    </button>
  );
}
