/**
 * Admin-only inline editor for a single topic on an edition. Opens as a
 * full-screen drawer on mobile, a side panel on desktop. Saves go through
 * editions.updateTopic, which patches just the affected topic in the
 * stored topics array, no full-edition regen needed for typos or one-
 * paragraph fixes.
 */
import { useEffect, useState } from "react";
import { Save, X } from "lucide-react";
import { toast } from "sonner";
import type { EditionTopic } from "@shared/schemas";
import { trpc } from "@/lib/trpc";

export function TopicEditDrawer({
  open,
  onClose,
  editionId,
  topicIndex,
  topic,
}: {
  open: boolean;
  onClose: () => void;
  editionId: number;
  topicIndex: number;
  topic: EditionTopic;
}) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState(topic.title);
  const [summary, setSummary] = useState(topic.summary);
  const [whyItMatters, setWhyItMatters] = useState(topic.whyItMatters ?? "");
  const [body, setBody] = useState(topic.body ?? "");
  const [keyTakeaway, setKeyTakeaway] = useState(topic.keyTakeaway ?? "");
  // whatToWatch edited as newline-separated text, easier than a list editor.
  const [watch, setWatch] = useState((topic.whatToWatch ?? []).join("\n"));

  // Re-seed when the drawer opens with a different topic.
  useEffect(() => {
    if (!open) return;
    setTitle(topic.title);
    setSummary(topic.summary);
    setWhyItMatters(topic.whyItMatters ?? "");
    setBody(topic.body ?? "");
    setKeyTakeaway(topic.keyTakeaway ?? "");
    setWatch((topic.whatToWatch ?? []).join("\n"));
  }, [open, topic]);

  const update = trpc.editions.updateTopic.useMutation({
    onSuccess: () => {
      utils.editions.getById.invalidate({ editionId });
      utils.editions.getByNumber.invalidate();
      utils.editions.list.invalidate();
      toast.success("Topic saved");
      onClose();
    },
    onError: (err) => toast.error(err.message ?? "Couldn't save"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !summary.trim()) {
      toast.error("Title and summary can't be empty");
      return;
    }
    const watchList = watch
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    update.mutate({
      editionId,
      topicIndex,
      title: title.trim(),
      summary: summary.trim(),
      whyItMatters: whyItMatters.trim() || null,
      body: body.trim() || null,
      keyTakeaway: keyTakeaway.trim() || null,
      whatToWatch: watchList.length > 0 ? watchList : null,
    });
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-2xl bg-[var(--color-bg)] border-l border-[var(--color-border)] flex flex-col"
        role="dialog"
        aria-label="Edit topic"
      >
        <header className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[var(--color-border)]">
          <div>
            <p
              className="overline-amber"
              style={{ letterSpacing: "0.22em", fontSize: "10px" }}
            >
              Admin · Edit topic
            </p>
            <p className="text-sm font-serif italic text-[var(--color-fg-muted)] mt-0.5 truncate">
              Topic #{topicIndex + 1}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-white/5"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form
          onSubmit={submit}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-4"
        >
          <Field label="Title">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={300}
              className="w-full px-3 py-2 rounded text-sm bg-black/20 border border-[var(--color-border)] focus:outline-none focus:border-amber-400/40 transition-colors"
            />
          </Field>

          <Field label="Summary (the italic lede)">
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              maxLength={2000}
              className="w-full px-3 py-2 rounded text-sm bg-black/20 border border-[var(--color-border)] focus:outline-none focus:border-amber-400/40 transition-colors leading-relaxed"
            />
          </Field>

          <Field label="Why this matters (one explicit sentence)">
            <textarea
              value={whyItMatters}
              onChange={(e) => setWhyItMatters(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="One sentence answering: why does the partner channel care about this specifically, right now?"
              className="w-full px-3 py-2 rounded text-sm bg-black/20 border border-[var(--color-border)] focus:outline-none focus:border-amber-400/40 transition-colors leading-relaxed"
            />
          </Field>

          <Field label="Body (the 600-800 word deep dive)">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={14}
              maxLength={20000}
              className="w-full px-3 py-2 rounded text-sm bg-black/20 border border-[var(--color-border)] focus:outline-none focus:border-amber-400/40 transition-colors leading-relaxed font-serif"
            />
            <p className="font-mono text-[10px] text-[var(--color-fg-subtle)] mt-1 tabular-nums">
              {body.trim().split(/\s+/).filter(Boolean).length} words
            </p>
          </Field>

          <Field label="Key takeaway (the line)">
            <textarea
              value={keyTakeaway}
              onChange={(e) => setKeyTakeaway(e.target.value)}
              rows={2}
              maxLength={2000}
              className="w-full px-3 py-2 rounded text-sm bg-black/20 border border-[var(--color-border)] focus:outline-none focus:border-amber-400/40 transition-colors leading-relaxed font-serif"
            />
          </Field>

          <Field label="What to watch (one per line)">
            <textarea
              value={watch}
              onChange={(e) => setWatch(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded text-sm bg-black/20 border border-[var(--color-border)] focus:outline-none focus:border-amber-400/40 transition-colors leading-relaxed"
              placeholder={"May 21: ABS labour force\nJune 16: RBA decision"}
            />
          </Field>
        </form>

        <footer className="px-6 py-4 border-t border-[var(--color-border)] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={update.isPending}
            className="inline-flex items-center gap-1.5 rounded px-4 py-2 text-[10px] font-mono uppercase tracking-[0.18em] transition-all active:scale-[0.98] disabled:opacity-50"
            style={{
              background:
                "var(--grad-cta-amber)",
              color: "var(--color-on-amber)",
            }}
          >
            <Save className="h-3 w-3" />
            {update.isPending ? "Saving…" : "Save"}
          </button>
        </footer>
      </aside>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        className="overline block mb-1.5 text-[var(--color-fg-subtle)]"
        style={{ letterSpacing: "0.18em", fontSize: "10px" }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
