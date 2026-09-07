import { Check, Image as ImageIcon, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { trpc } from "@/lib/trpc";

type Props = {
  shareToken: string;
  headline: string;
  comparison?: boolean;
};

function base64ToFile(base64: string, mimeType: string, filename: string): File {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mimeType });
}

function shareSurface(): "ask" | "markets" | "brief" {
  if (typeof window === "undefined") return "ask";
  if (window.location.pathname.startsWith("/markets")) return "markets";
  if (window.location.pathname.startsWith("/brief")) return "brief";
  return "ask";
}

/**
 * Builds a 4:5 distribution asset from the server-issued token attached to a
 * grounded Ask answer. The browser never sends editable answer copy back to be
 * signed, so a share badge can only represent intelligence The Desk actually
 * produced and source-checked.
 */
export function ShareIntelligenceCardButton({ shareToken, headline, comparison = false }: Props) {
  const [complete, setComplete] = useState(false);
  const card = trpc.ask.shareCard.useMutation();

  async function createAndShare() {
    setComplete(false);
    let rendered;
    try {
      rendered = await card.mutateAsync({ token: shareToken });
    } catch {
      return; // The mutation error is displayed beside the share action.
    }

    const file = base64ToFile(rendered.base64, rendered.mimeType, rendered.filename);
    const publicUrl = new URL(rendered.sharePath, window.location.origin).toString();
    const shareText = `The Desk intelligence brief: ${headline}`;

    if (navigator.share) {
      const canShareFile = navigator.canShare?.({ files: [file] }) ?? false;
      try {
        if (canShareFile) {
          await navigator.share({
            files: [file],
            title: headline,
            text: shareText,
            url: publicUrl,
          });
        } else {
          await navigator.share({ title: headline, text: shareText, url: publicUrl });
        }
        trackEvent(comparison ? "market_compare_share" : "ask_share", shareSurface());
        setComplete(true);
        window.setTimeout(() => setComplete(false), 2200);
        return;
      } catch {
        // Cancellation or a platform-specific failure falls through to the
        // deterministic image-export + clipboard path below.
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
      // The image remains useful when Clipboard API permission is unavailable.
    }

    trackEvent(comparison ? "market_compare_share" : "ask_share", shareSurface());
    setComplete(true);
    window.setTimeout(() => setComplete(false), 2200);
  }

  return (
    <span className="inline-flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => void createAndShare()}
        disabled={card.isPending || !shareToken}
        className="bs-btn bs-btn-solid inline-flex items-center gap-2 disabled:opacity-50"
        title={card.error?.message}
      >
        {card.isPending ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : complete ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <ImageIcon className="h-3.5 w-3.5" />
        )}
        {card.isPending
          ? "Building share"
          : complete
            ? "Share ready"
            : comparison
              ? "Share comparison"
              : "Share intelligence"}
      </button>
      {card.error && (
        <span role="alert" className="text-sm text-[var(--color-fg-muted)]">
          {card.error.message}
        </span>
      )}
    </span>
  );
}
