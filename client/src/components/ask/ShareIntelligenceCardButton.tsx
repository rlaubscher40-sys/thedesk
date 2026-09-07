import { Check, Image as ImageIcon, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

type Signal = { label: string; value: string; context: string };

type Props = {
  question: string;
  headline: string;
  answer: string;
  deskTake: string;
  confidence: "high" | "medium" | "low";
  sourceCount: number;
  signal?: Signal | null;
};

function base64ToFile(base64: string, mimeType: string, filename: string): File {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mimeType });
}

/**
 * Builds the 4:5 distribution card and a signed 30-day public brief URL in one
 * action. Phones get the native share sheet; desktop saves the asset and copies
 * the public brief link so distribution always has a destination, not just an
 * image with nowhere to continue the intelligence loop.
 */
export function ShareIntelligenceCardButton(props: Props) {
  const [complete, setComplete] = useState(false);
  const card = trpc.ask.shareCard.useMutation();

  async function createAndShare() {
    setComplete(false);
    const rendered = await card.mutateAsync({
      question: props.question,
      headline: props.headline,
      answer: props.answer,
      deskTake: props.deskTake,
      confidence: props.confidence,
      sourceCount: props.sourceCount,
      signal: props.signal ?? null,
    });

    const file = base64ToFile(rendered.base64, rendered.mimeType, rendered.filename);
    const publicUrl = new URL(rendered.sharePath, window.location.origin).toString();
    const shareText = `The Desk intelligence brief: ${props.headline}`;

    if (navigator.share) {
      const canShareFile = navigator.canShare?.({ files: [file] }) ?? false;
      try {
        if (canShareFile) {
          await navigator.share({
            files: [file],
            title: props.headline,
            text: shareText,
            url: publicUrl,
          });
        } else {
          await navigator.share({
            title: props.headline,
            text: shareText,
            url: publicUrl,
          });
        }
        setComplete(true);
        window.setTimeout(() => setComplete(false), 2200);
        return;
      } catch {
        // Cancellation or a platform-specific share failure falls through to
        // the deterministic desktop-style asset + clipboard path below.
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
      // The image export is still useful in a non-secure/local browser where
      // Clipboard API permission is unavailable.
    }

    setComplete(true);
    window.setTimeout(() => setComplete(false), 2200);
  }

  return (
    <button
      type="button"
      onClick={() => void createAndShare()}
      disabled={card.isPending}
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
      {card.isPending ? "Building share" : complete ? "Share ready" : "Share intelligence"}
    </button>
  );
}
