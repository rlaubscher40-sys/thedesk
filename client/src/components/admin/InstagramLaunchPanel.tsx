import { useState } from "react";
import { toast } from "sonner";
import { LAUNCH_POST_IDS, LAUNCH_POST_LABELS, type LaunchPostId } from "@shared/instagramLaunch";
import { trpc } from "@/lib/trpc";

export function InstagramLaunchPanel() {
  const [id, setId] = useState<LaunchPostId>("start");
  const [reviewing, setReviewing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const utils = trpc.useUtils();
  const status = trpc.instagram.launchStatus.useQuery();
  const preview = trpc.instagram.launchPreview.useQuery(
    { id },
    {
      enabled: reviewing,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );
  const publish = trpc.instagram.launchPublish.useMutation({
    onSuccess: (result) => toast.success(`${result.title} published · media ${result.postId}`),
    onError: (error) => toast.error(error.message),
    onSettled: async () => {
      setConfirmed(false);
      await Promise.all([
        utils.instagram.launchStatus.invalidate(),
        utils.instagram.listAll.invalidate(),
        utils.instagram.publishingStatus.invalidate(),
      ]);
    },
  });
  const record = status.data?.posts.find((post) => post.jobKey === `instagram-launch-v1-${id}`);
  return (
    <div className="border border-[var(--color-border)] p-4 space-y-4">
      <h3 className="font-serif text-xl">Set up the profile</h3>
      <p className="text-sm text-[var(--color-fg-muted)]">
        Publish the three launch posts through the existing Meta connection. Review every slide and
        the caption first. These are one-time posts, separate from the daily schedule.
      </p>
      <div className="flex flex-wrap gap-3">
        {LAUNCH_POST_IDS.map((slot) => (
          <button
            key={slot}
            disabled={publish.isPending}
            aria-pressed={slot === id}
            className="border border-[var(--color-border)] px-3 py-2 text-sm aria-pressed:text-[var(--color-accent)]"
            onClick={() => {
              setId(slot);
              publish.reset();
              setReviewing(false);
              setConfirmed(false);
            }}
          >
            {LAUNCH_POST_LABELS[slot]}
          </button>
        ))}
      </div>
      {record && (
        <p role="status" className="text-sm">
          {record.status === "success"
            ? "Published"
            : "Reserved — check the profile before recovery"}
          . {record.detail}
        </p>
      )}
      {publish.error && <p role="alert" className="text-sm">{publish.error.message}</p>}
      {!status.data?.available && (
        <p className="text-sm">
          Publication is unavailable until the saved post records can be read.
        </p>
      )}
      <button
        disabled={publish.isPending || preview.isFetching}
        className="text-sm underline"
        onClick={() => {
          setConfirmed(false);
          setReviewing(true);
          if (reviewing) void preview.refetch();
        }}
      >
        {preview.isFetching ? "Preparing preview…" : "Preview current post"}
      </button>
      {reviewing && preview.error && <p role="alert">{preview.error.message}</p>}
      {reviewing && preview.data && !preview.isFetching && !preview.error && (
        <>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {preview.data.images.map((src, index) => (
              <img
                key={index}
                src={src}
                alt={`${preview.data.title}, slide ${index + 1}`}
                width={270}
                height={338}
                className="w-[270px] shrink-0"
              />
            ))}
          </div>
          <p className="whitespace-pre-wrap text-sm max-w-[70ch]">{preview.data.caption}</p>
          {!record && (
            <>
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  disabled={publish.isPending}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                I reviewed every slide and the caption. Publish this post to the connected Instagram
                account.
              </label>
              <button
                disabled={!confirmed || !status.data?.available || publish.isPending}
                className="border border-[var(--color-border)] px-4 py-2 disabled:opacity-40"
                onClick={() => {
                  if (preview.data) publish.mutate({ id, contentHash: preview.data.contentHash });
                }}
              >
                {publish.isPending ? "Publishing through Meta…" : "Publish reviewed post"}
              </button>
            </>
          )}
        </>
      )}
      <p className="text-xs text-[var(--color-fg-muted)]">
        After publication, pin the posts and update the profile link in Instagram. A missing Meta
        confirmation locks the slot; it will not automatically post again.
      </p>
    </div>
  );
}
