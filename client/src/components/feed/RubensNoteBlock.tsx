/**
 * "Ruben's note", editorial override that takes visual precedence on a
 * feed card. When set, replaces the AI-generated SayThisLine. Admin sees
 * an edit affordance; everyone else just reads it.
 */
import { useEffect, useState } from "react";
import { Pencil, Quote, Save, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/useAuth";

export function RubensNoteBlock({
  itemId,
  note,
}: {
  itemId: number;
  note: string | null;
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note ?? "");

  useEffect(() => {
    setDraft(note ?? "");
  }, [note]);

  const mutation = trpc.feed.setRubensNote.useMutation({
    onSuccess: () => {
      toast.success(draft.trim() ? "Note saved" : "Note cleared");
      utils.feed.getByDate.invalidate();
      utils.feed.getById.invalidate();
      setEditing(false);
    },
    onError: (err) => toast.error(err.message || "Couldn't save"),
  });

  function save() {
    mutation.mutate({ id: itemId, note: draft });
  }

  // Hide entirely if there's no note AND user can't add one.
  if (!note && !isAdmin) return null;

  if (editing && isAdmin) {
    return (
      <div
        className="mt-5 p-4 rounded-sm"
        style={{
          background: "oklch(0.78 0.18 70 / 8%)",
          boxShadow: "inset 0 0 0 1px oklch(0.78 0.18 70 / 28%)",
        }}
      >
        <p
          className="overline-amber mb-2"
          style={{ letterSpacing: "0.22em", fontSize: "10px" }}
        >
          Ruben's note
        </p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          maxLength={600}
          placeholder="Your editorial take on this story, replaces the AI line."
          className="w-full px-3 py-2 rounded text-sm bg-[var(--color-bg-deep)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-amber)]/50 transition-colors font-serif italic leading-relaxed"
          autoFocus
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={save}
            disabled={mutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[10px] font-mono uppercase tracking-[0.18em] disabled:opacity-50"
            style={{
              background:
                "var(--grad-cta-amber)",
              color: "var(--color-on-amber)",
            }}
          >
            <Save className="h-3 w-3" />
            {mutation.isPending ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => {
              setDraft(note ?? "");
              setEditing(false);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            <X className="h-3 w-3" />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!note) {
    // Admin, no note yet, show a quiet "add note" affordance.
    return (
      <button
        onClick={() => setEditing(true)}
        className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-fg-subtle)] hover:text-amber-300 transition-colors"
      >
        <Pencil className="h-3 w-3" />
        Add Ruben's note
      </button>
    );
  }

  return (
    <div
      className="mt-5 p-4 rounded-sm relative group"
      style={{
        background: "oklch(0.78 0.18 70 / 8%)",
        boxShadow: "inset 0 0 0 1px oklch(0.78 0.18 70 / 28%)",
      }}
    >
      <div className="flex items-start gap-3">
        <Quote className="h-4 w-4 shrink-0 mt-0.5 text-amber-300" />
        <div className="min-w-0 flex-1">
          <p
            className="overline-amber mb-1.5"
            style={{ letterSpacing: "0.22em", fontSize: "10px" }}
          >
            Ruben's note
          </p>
          <p className="font-serif italic text-[15px] leading-relaxed text-[var(--color-fg)]">
            {note}
          </p>
        </div>
      </div>
      {isAdmin && (
        <button
          onClick={() => setEditing(true)}
          aria-label="Edit Ruben's note"
          className="absolute top-2 right-2 p-1 rounded text-[var(--color-fg-subtle)] opacity-0 group-hover:opacity-100 hover:text-amber-300 transition-all"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
