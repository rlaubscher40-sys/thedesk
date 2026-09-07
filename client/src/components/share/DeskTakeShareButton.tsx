import { Check, LoaderCircle, Quote, Share2 } from "lucide-react";
import { useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { trpc } from "@/lib/trpc";

function base64ToFile(base64: string, mimeType: string, filename: string): File {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mimeType });
}

export function DeskTakeShareButton({ id, title }: { id: number; title: string }) {
  const [complete, setComplete] = useState(false);
  const mutation = trpc.share.takeCard.useMutation();

  async function share() {
    setComplete(false);
    try {
      const rendered = await mutation.mutateAsync({ id });
      const file = base64ToFile(rendered.base64, rendered.mimeType, rendered.filename);
      const publicUrl = new URL(rendered.sharePath, window.location.origin).toString();

      if (navigator.share) {
        try {
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `The Desk Take · ${title}`,
              text: rendered.caption,
              url: publicUrl,
            });
          } else {
            await navigator.share({
              title: `The Desk Take · ${title}`,
              text: rendered.caption,
              url: publicUrl,
            });
          }
          trackEvent("take_share", "story");
          setComplete(true);
          window.setTimeout(() => setComplete(false), 2000);
          return;
        } catch {
          // Native share cancellation/failure falls through to export.
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
        await navigator.clipboard.writeText(`${rendered.caption}\n\n${publicUrl}`);
      } catch {
        // Export still succeeds if Clipboard API is unavailable.
      }
      trackEvent("take_share", "story");
      setComplete(true);
      window.setTimeout(() => setComplete(false), 2000);
    } catch {
      // Mutation error is exposed in the title attribute below.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      disabled={mutation.isPending}
      className="bs-btn bs-btn-outline inline-flex items-center gap-2 disabled:opacity-50"
      title={mutation.error?.message ?? "Share the editorial read as a native 4:5 card"}
    >
      {mutation.isPending ? (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      ) : complete ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Quote className="h-3.5 w-3.5" />
      )}
      {mutation.isPending ? "Building take" : complete ? "Take ready" : "Share The Desk Take"}
      {!mutation.isPending && !complete && <Share2 className="h-3 w-3 opacity-60" />}
    </button>
  );
}
