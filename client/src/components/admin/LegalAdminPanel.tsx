import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  PUBLICATION_LABELS,
  type PublicationChannel,
} from "../../../../shared/publicationControls";

export function LegalAdminPanel() {
  const utils = trpc.useUtils();
  const controls = trpc.legal.controls.useQuery(undefined, { refetchInterval: 15000 });
  const reviews = trpc.legal.reviews.useQuery();
  const events = trpc.legal.events.useQuery();
  const [reason, setReason] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [holdId, setHoldId] = useState("");
  const [holdNote, setHoldNote] = useState("");
  const hold = trpc.legal.holdStory.useMutation({
    onSuccess: async () => {
      setHoldId("");
      setHoldNote("");
      await utils.legal.reviews.invalidate();
    },
  });
  const inventory = trpc.legal.privacyInventory.useMutation();
  const [notes, setNotes] = useState<Record<number, string>>({});
  const save = trpc.legal.setControl.useMutation({
    onSuccess: async () => {
      setReason("");
      await Promise.all([utils.legal.controls.invalidate(), utils.legal.events.invalidate()]);
    },
  });
  const decide = trpc.legal.decideReview.useMutation({
    onSuccess: async () => {
      await utils.legal.reviews.invalidate();
    },
  });
  const error =
    controls.error ?? reviews.error ?? events.error ?? save.error ?? decide.error ?? hold.error;
  const globallyPaused = controls.data?.some((c) => c.channel === "all" && c.paused);
  return (
    <section
      className="panel p-5 sm:p-7 space-y-6 my-6"
      aria-labelledby="publishing-controls-title"
    >
      <div>
        <h2 id="publishing-controls-title" className="font-serif text-2xl">
          Publishing controls
        </h2>
        <p className="text-sm text-[var(--color-fg-muted)] mt-2">
          Pause new publishing while investigating a complaint or incident. Existing posts and
          emails already accepted by a provider remain available. Subscription confirmations and
          admin alerts continue.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error.message}
        </p>
      )}
      {controls.isLoading && <p role="status">Loading publishing status…</p>}
      <label className="block text-sm">
        Reason for pausing or resuming
        <textarea
          className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 w-full mt-2"
          rows={2}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Record the incident reference or reason. Keep personal details out."
        />
      </label>
      <div className="space-y-3">
        {controls.data?.map((control) => (
          <div
            key={control.channel}
            className="flex flex-wrap gap-3 items-center justify-between border-t border-[var(--color-border)] pt-3"
          >
            <div className="min-w-0">
              <p className="font-medium">
                {PUBLICATION_LABELS[control.channel as PublicationChannel]}
              </p>
              <p className="text-sm text-[var(--color-fg-muted)]">
                {control.paused
                  ? "Paused"
                  : globallyPaused && control.channel !== "all"
                    ? "Paused by the all-publishing control"
                    : "Enabled"}
                {control.reason ? ` · ${control.reason}` : ""}
              </p>
            </div>
            <button
              type="button"
              className="bs-btn bs-btn-outline"
              disabled={save.isPending || reason.trim().length < 5}
              onClick={() =>
                save.mutate({
                  channel: control.channel,
                  paused: !control.paused,
                  reason,
                  expectedRevision: control.revision,
                })
              }
            >
              {control.paused ? "Resume" : "Pause"}
            </button>
          </div>
        ))}
      </div>
      <div className="border-t border-[var(--color-border)] pt-5 space-y-3">
        <h3 className="font-serif text-xl">Stories awaiting review</h3>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Flags identify possible allegations, court restrictions or commercial relationships. Read
          the source and check accuracy, context, restrictions and disclosures before approving. A
          flag is not a finding of wrongdoing. Unflagged stories have not received legal clearance.
        </p>
        {reviews.isLoading ? (
          <p role="status">Loading review queue…</p>
        ) : reviews.data?.length === 0 ? (
          <p className="text-sm">No stories awaiting review.</p>
        ) : null}
        {reviews.data?.map((review) => (
          <article
            key={review.feedItemId}
            className="border border-[var(--color-border)] p-4 space-y-3"
          >
            <h4 className="font-semibold">{review.title}</h4>
            <p className="text-sm">{review.summary}</p>
            <p className="text-sm">{review.reasons.join(" · ")}</p>
            {review.sourceUrl && /^https?:\/\//i.test(review.sourceUrl) && (
              <a
                href={review.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bs-link"
              >
                Read original source
              </a>
            )}
            <label className="block text-sm">
              Review findings and decision
              <textarea
                className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 w-full mt-2"
                rows={3}
                maxLength={1000}
                value={notes[review.feedItemId] ?? ""}
                onChange={(e) => setNotes({ ...notes, [review.feedItemId]: e.target.value })}
              />
            </label>
            <div className="flex flex-wrap gap-3">
              {(["approve", "reject"] as const).map((decision) => (
                <button
                  key={decision}
                  type="button"
                  className="bs-btn bs-btn-outline"
                  disabled={
                    decide.isPending ||
                    (notes[review.feedItemId]?.trim().length ?? 0) < 20 ||
                    (decision === "approve" &&
                      controls.data?.some(
                        (c) => (c.channel === "all" || c.channel === "website") && c.paused
                      ))
                  }
                  onClick={() =>
                    decide.mutate({
                      feedItemId: review.feedItemId,
                      decision,
                      note: notes[review.feedItemId]!,
                    })
                  }
                >
                  {decision === "approve" ? "Approve publication" : "Keep unpublished"}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
      <details>
        <summary className="bs-link">Recent control changes</summary>
        <ul className="text-sm space-y-2 mt-3">
          {events.data?.map((event, i) => (
            <li key={i}>
              {event.channel}: {event.paused ? "paused" : "resumed"} by editor {event.actorId}.{" "}
              {event.reason}
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary className="bs-link">Hold an existing website story</summary>
        <form
          className="space-y-3 mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            hold.mutate({ feedItemId: Number(holdId), note: holdNote });
          }}
        >
          <p className="text-sm">
            Pause all publishing first. This removes the story from normal website reads after
            caches expire. Review queued emails, social posts, share links and published copies
            before resuming. Sent emails cannot be recalled.
          </p>
          <label className="block text-sm">
            Story ID from its /story/ URL
            <input
              className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 block mt-2"
              type="number"
              min="1"
              step="1"
              required
              value={holdId}
              onChange={(e) => setHoldId(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Reason and incident reference
            <textarea
              className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 block w-full mt-2"
              rows={2}
              required
              minLength={20}
              maxLength={1000}
              value={holdNote}
              onChange={(e) => setHoldNote(e.target.value)}
            />
          </label>
          <button
            className="bs-btn bs-btn-outline"
            disabled={!globallyPaused || hold.isPending || holdNote.trim().length < 20}
          >
            Hold website story
          </button>
          {hold.isSuccess && (
            <p role="status">
              Website story held. Review other copies before resuming publication.
            </p>
          )}
        </form>
      </details>
      <details>
        <summary className="bs-link">Prepare a privacy request</summary>
        <form
          className="space-y-3 mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            inventory.mutate({ email: requestEmail });
          }}
        >
          <p className="text-sm">
            Internal inventory only. Verify the requester before sharing records or deleting data.
            Provider logs, backups and unlinked messages need a separate check.
          </p>
          <label className="block text-sm">
            Requester email
            <input
              type="email"
              required
              maxLength={320}
              className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 block w-full mt-2"
              value={requestEmail}
              onChange={(e) => {
                setRequestEmail(e.target.value);
                inventory.reset();
              }}
            />
          </label>
          <button className="bs-btn bs-btn-outline" disabled={inventory.isPending}>
            Find records
          </button>
          {inventory.error && <p role="alert">{inventory.error.message}</p>}
          {inventory.data && (
            <div className="text-sm space-y-2" role="status">
              <p>
                {inventory.data.demoMode
                  ? "Demo only: no real personal data searched."
                  : "Inventory prepared. No data was changed or sent."}
              </p>
              <p>
                Subscriber: {inventory.data.subscriber ? "found" : "not found"}. Consent history:{" "}
                {inventory.data.consentEvents.length} recent events.
              </p>
              <ul>
                {Object.entries(inventory.data.counts).map(([kind, count]) => (
                  <li key={kind}>
                    {kind}: {count}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>
      </details>
    </section>
  );
}
