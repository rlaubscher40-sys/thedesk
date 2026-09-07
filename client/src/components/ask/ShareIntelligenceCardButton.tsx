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
 * Builds the 4:5 distribution card only when the reader asks for it, then
 * uses the native share sheet on phones where file-sharing is supported.
 * Desktop falls back to saving the PNG locally so it can be dropped straight
 * into Instagram, LinkedIn or a message.
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
    const sharePayload = { files: [file], title: props.headline };

    if (navigator.share && navigator.canShare?.(sharePayload)) {
      try {
        await navigator.share(sharePayload);
        setComplete(true);
        window.setTimeout(() => setComplete(false), 2200);
        return;
      } catch {
        // Cancelling the share sheet should still leave the asset available
        // through the normal browser fallback below.
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
      {card.isPending ? "Building card" : complete ? "Card ready" : "Share card"}
    </button>
  );
}
