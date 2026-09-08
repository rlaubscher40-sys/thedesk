import { REEL_WINDOW } from "@shared/instagramSchedule";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

export function InstagramReelPanel() {
  const readiness = trpc.instagram.reelReadiness.useQuery(undefined, { staleTime: 60_000 });
  const plan = trpc.instagram.reelPlan.useQuery(undefined, {
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const [video, setVideo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(
    () => () => {
      if (video) URL.revokeObjectURL(video);
    },
    [video]
  );
  async function preview() {
    setBusy(true);
    setError(null);
    setVideo(null);
    try {
      const response = await fetch(
        `/api/instagram/preview/reel?variant=${plan.data?.variant ?? "navy"}`,
        { signal: AbortSignal.timeout(280_000) }
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          body.message ?? body.error ?? "The Reel could not be rendered. Try again later."
        );
      }
      if (response.headers.get("X-Reel-Narrated") !== "true")
        throw new Error("The voice track could not be verified.");
      if (response.headers.get("X-Reel-Subtitled") !== "true")
        throw new Error("The subtitles could not be verified.");
      setVideo(URL.createObjectURL(await response.blob()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded border border-[var(--color-border)] p-4 space-y-3">
      <h3 className="font-semibold">Automatic narrated Reels</h3>
      <p className="text-sm">
        {readiness.data?.detail ??
          (readiness.error
            ? "Could not check the voice and renderer."
            : "Checking the voice and renderer…")}
      </p>
      {plan.data && (
        <>
          <p className="text-sm">
            Automatic publishing:{" "}
            {plan.data.schedulerEnabled && plan.data.accountConfigured ? "enabled" : "off"}.{" "}
            {plan.data.schedule}.
          </p>
          <p className="text-sm">
            The programme covers Brisbane–Perth rents, dwelling approvals and eight-capital rent
            growth. Each topic posts once per reference month. At most one automatic Reel goes out
            per Sydney day; a second eligible topic waits until tomorrow. Missing evidence, audio or
            subtitles means no post.
          </p>
          <p className="text-sm">
            Next cover: {plan.data.variant === "navy" ? "navy" : "light"}, alternating with the last
            recorded grid post. Pinned posts keep their existing colours.
          </p>
          <p className="text-sm" role="status">
            {plan.data.publication === "published"
              ? `Published to Instagram. Confirmed media ID: ${plan.data.postId}.`
              : !plan.data.schedulerEnabled || !plan.data.accountConfigured
                ? "Automatic publishing is off. Check the scheduler and connected account configuration."
                : plan.data.publication === "ready"
                  ? "Ready for the next automatic check. The server checks every five minutes, including after a restart."
                  : plan.data.publication === "scheduled"
                    ? `The next eligible story waits for the ${REEL_WINDOW.label} publishing window.`
                    : plan.data.publication === "daily-limit"
                      ? "Today's automatic Reel slot is used. The next eligible story waits until tomorrow."
                      : plan.data.publication === "running"
                        ? "Rendering or publishing. This continues on the server if you close this page."
                        : plan.data.publication === "retrying"
                          ? "The last attempt failed before confirmed publication. A safe retry is scheduled after a 15-minute cooldown."
                          : plan.data.publication === "paused"
                            ? "Automatic attempts are paused for today after a failure. They resume tomorrow if the publication slot is still unused."
                            : plan.data.publication === "locked"
                              ? "Publication needs inspection. The outcome may be uncertain, so automatic reposting is locked."
                              : plan.data.publication === "no-evidence"
                                ? "No current matching ABS evidence is available."
                                : "The publication record is unavailable; publishing is blocked."}
          </p>
          {plan.data.detail && (
            <p className="text-xs break-words" role="alert">
              Last result: {plan.data.detail}
            </p>
          )}
        </>
      )}
      {plan.error && <p role="alert">Could not check the schedule and evidence.</p>}
      <button
        type="button"
        disabled={busy || !readiness.data?.ok || !plan.data?.caption}
        onClick={preview}
        className="rounded border px-4 py-2 text-sm disabled:opacity-50"
      >
        {busy ? "Rendering with sound… this may take a few minutes" : "Preview Reel with sound"}
      </button>
      <button
        type="button"
        onClick={() => void plan.refetch()}
        disabled={plan.isFetching}
        className="rounded border px-4 py-2 text-sm disabled:opacity-50"
      >
        Refresh publishing status
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
      {video && (
        <div className="space-y-2">
          <video
            src={video}
            controls
            playsInline
            preload="metadata"
            onError={() =>
              setError(
                "The video was generated, but this browser could not play it. Use the download link below."
              )
            }
            className="w-full max-w-sm rounded"
            aria-label="Narrated property Reel preview"
          />
          <a href={video} download="The-Desk-Reel-Preview.mp4" className="underline text-sm">
            Download the Reel preview
          </a>
        </div>
      )}
      {plan.data?.caption && (
        <details>
          <summary className="cursor-pointer text-sm">Read the sourced caption</summary>
          <p className="whitespace-pre-wrap text-sm mt-3">{plan.data.caption}</p>
        </details>
      )}
      <p className="text-xs text-[var(--color-fg-muted)]">
        Previewing does not publish. Spoken captions are included for watching without sound. The
        voice is a synthetic male UK English voice (George) and runs locally, with no speech API
        fee. Publishing runs on the server even when this page is closed.
      </p>
    </section>
  );
}
