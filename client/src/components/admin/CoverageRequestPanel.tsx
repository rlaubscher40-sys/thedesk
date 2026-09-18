/**
 * Editorial triage for reader coverage requests.
 *
 * Reads the same private inbox as the feedback panel, scoped to `coverage`
 * submissions, and adds the two things triage needs that feedback does not: a
 * view of what is being asked about, and a way to record the outcome — including
 * linking the published answer back to the request that prompted it.
 *
 * Nothing here publishes anything. The outcome is a note on a private row; the
 * answer is reporting an editor wrote and published through the normal pipeline.
 */
import { useState } from "react";
import { toast } from "sonner";
import type { FeedbackSubmission } from "@shared/types";
import { trpc } from "@/lib/trpc";
import {
  REQUEST_USE_BASIS,
  publishedAnswerPath,
  readerTaskLabel,
  requestGeographyLabel,
  requestTopicLabel,
  tallyRequests,
  triageQueue,
  type ReaderRequest,
} from "@shared/readerRequests";

const DIMENSIONS = [
  ["topic", "By topic"],
  ["geography", "By place"],
  ["readerTask", "By reader"],
] as const;

function asReaderRequest(row: FeedbackSubmission): ReaderRequest {
  return {
    id: row.id,
    topic: row.topic ?? null,
    geography: row.geography ?? null,
    readerTask: row.readerTask ?? null,
    status: row.status,
    answerUrl: row.answerUrl ?? null,
    createdAt: row.createdAt,
  };
}

export function CoverageRequestPanel() {
  const utils = trpc.useUtils();
  const listQuery = trpc.feedback.list.useQuery();
  const setOutcome = trpc.feedback.setRequestOutcome.useMutation({
    onSuccess: () => {
      utils.feedback.list.invalidate();
      utils.feedback.newCount.invalidate();
      toast.success("Outcome recorded");
    },
    onError: (error) => toast.error(error.message || "Couldn't record the outcome"),
  });

  const rows = (listQuery.data ?? []).filter((row) => row.kind === "coverage");
  const requests = rows.map(asReaderRequest);
  const queue = triageQueue(requests);

  return (
    <section className="panel rounded p-6 sm:p-8 space-y-5">
      <div>
        <p className="overline-amber mb-2" style={{ letterSpacing: "0.22em", fontSize: "10px" }}>
          Coverage requests
        </p>
        <h2 className="font-serif text-2xl font-bold leading-tight">What readers want reported</h2>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1.5 max-w-[70ch]">
          {rows.length === 0
            ? "No coverage requests yet. This counts submissions, not demand: an empty inbox is an empty inbox, not evidence that readers have nothing to ask."
            : `${rows.length} request${rows.length === 1 ? "" : "s"}, ${queue.length} untriaged. These are self-selected submissions from readers who happened to be on the site, not a representative sample of the market.`}
        </p>
        <p className="text-xs text-[var(--color-fg-subtle)] mt-2 max-w-[70ch] leading-relaxed">
          {REQUEST_USE_BASIS}
        </p>
      </div>

      {rows.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-5">
          {DIMENSIONS.map(([dimension, label]) => (
            <div key={dimension}>
              <p className="overline text-[var(--color-fg-subtle)] mb-2">{label}</p>
              <ul className="space-y-1 text-sm">
                {tallyRequests(requests, dimension).map((tally) => (
                  <li key={tally.key} className="flex justify-between gap-3">
                    <span className="truncate">{tally.label}</span>
                    <span className="font-mono text-[var(--color-fg-subtle)]">{tally.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((row) => (
            <RequestRow
              key={row.id}
              row={row}
              pending={setOutcome.isPending}
              onOutcome={(status, answerUrl) =>
                setOutcome.mutate({ id: row.id, status, answerUrl })
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function RequestRow({
  row,
  pending,
  onOutcome,
}: {
  row: FeedbackSubmission;
  pending: boolean;
  onOutcome: (
    status: "new" | "reviewed" | "answered" | "declined",
    answerUrl: string | null
  ) => void;
}) {
  const [answer, setAnswer] = useState(row.answerUrl ?? "");
  const validAnswer = publishedAnswerPath(answer);
  const labels = [
    requestTopicLabel(row.topic),
    requestGeographyLabel(row.geography),
    readerTaskLabel(row.readerTask),
  ].filter((label): label is string => label !== null);

  return (
    <li className="panel rounded p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="overline-amber" style={{ letterSpacing: "0.18em", fontSize: "10px" }}>
          {row.status}
        </span>
        {labels.map((label) => (
          <span key={label} className="overline text-[var(--color-fg-subtle)]">
            {label}
          </span>
        ))}
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-line">{row.message}</p>
      {row.answerUrl && (
        <p className="text-sm">
          Answered by{" "}
          <a className="underline" href={row.answerUrl}>
            {row.answerUrl}
          </a>
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-xs">
          <span className="overline mb-1.5 block text-[var(--color-fg-subtle)]">
            Published answer (a Desk page, e.g. /story/1234)
          </span>
          <input
            type="text"
            value={answer}
            maxLength={512}
            placeholder="/story/1234"
            onChange={(event) => setAnswer(event.target.value)}
            className="w-[28ch] max-w-full min-h-11 px-3 py-2 rounded text-sm bg-[var(--color-bg-deep)] border border-[var(--color-border)]"
          />
        </label>
        <button
          type="button"
          disabled={pending || validAnswer === null}
          title={
            validAnswer === null ? "Enter a Desk page path before marking this answered" : undefined
          }
          onClick={() => onOutcome("answered", validAnswer)}
          className="min-h-11 px-3 rounded text-xs font-mono uppercase tracking-[0.18em] border border-[var(--color-border)] disabled:opacity-50"
        >
          Answered
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => onOutcome("reviewed", null)}
          className="min-h-11 px-3 rounded text-xs font-mono uppercase tracking-[0.18em] border border-[var(--color-border)] disabled:opacity-50"
        >
          Reviewed
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => onOutcome("declined", null)}
          className="min-h-11 px-3 rounded text-xs font-mono uppercase tracking-[0.18em] border border-[var(--color-border)] disabled:opacity-50"
        >
          Not covering
        </button>
      </div>
    </li>
  );
}
