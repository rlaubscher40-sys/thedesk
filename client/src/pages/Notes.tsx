/**
 * Per-week notes. Auto-saves on a short debounce so the user never has to
 * remember to hit save.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Save } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/Button";
import { getIsoWeekId } from "@/lib/date";
import { useAuth } from "@/lib/useAuth";
import { trpc } from "@/lib/trpc";

export default function NotesPage() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const currentWeek = useMemo(() => getIsoWeekId(), []);
  const [selectedWeek, setSelectedWeek] = useState(currentWeek);
  const [content, setContent] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  const listQuery = trpc.notes.list.useQuery(undefined, { enabled: isAuthenticated });
  const noteQuery = trpc.notes.get.useQuery({ weekId: selectedWeek }, { enabled: isAuthenticated });

  useEffect(() => {
    if (noteQuery.data) setContent(noteQuery.data.content ?? "");
  }, [noteQuery.data, selectedWeek]);

  const save = trpc.notes.save.useMutation({
    onSuccess: () => {
      setSavedAt(new Date());
      utils.notes.list.invalidate();
    },
  });

  // Debounced auto-save.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (noteQuery.data?.content === content) return;
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      save.mutate({ weekId: selectedWeek, content });
    }, 800);
    return () => {
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    };
  }, [content, selectedWeek, isAuthenticated, noteQuery.data?.content, save]);

  if (!isAuthenticated) {
    return (
      <div>
        <PageHeader overline="The Desk · Notes" title="Sign in to take notes" />
        <p className="text-sm text-[var(--color-fg-muted)]">
          Notes are scoped to your account. Sign in to start writing.
        </p>
      </div>
    );
  }

  const weeks = (listQuery.data ?? []).map((n) => n.weekId);
  const allWeeks = Array.from(new Set([currentWeek, ...weeks]));

  return (
    <div>
      <PageHeader
        overline="The Desk · Notes"
        title="Weekly notes"
        kicker={savedAt ? `Saved ${savedAt.toLocaleTimeString("en-AU")}` : "Auto-saves as you type."}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6">
        <aside className="space-y-1">
          <p className="overline mb-2">Weeks</p>
          {allWeeks.map((w, idx) => (
            <button
              key={w || `week-${idx}`}
              onClick={() => setSelectedWeek(w)}
              className={`w-full text-left px-3 py-2 rounded text-sm font-mono transition-colors ${
                selectedWeek === w
                  ? "bg-amber-500/15 text-amber-200 border border-amber-500/40"
                  : "border border-transparent text-[var(--color-fg-muted)] hover:bg-white/5"
              }`}
            >
              {w}
            </button>
          ))}
        </aside>

        <SectionErrorBoundary section="Note editor">
          <div className="panel rounded p-4 sm:p-6">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What did you learn this week?"
              rows={18}
              className="w-full bg-transparent border-0 text-base leading-relaxed resize-y focus:outline-none"
            />
            <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex items-center justify-between">
              <p className="overline">{content.length} chars</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => save.mutate({ weekId: selectedWeek, content })}
                disabled={save.isPending}
              >
                <Save className="h-3.5 w-3.5" /> Save now
              </Button>
            </div>
          </div>
        </SectionErrorBoundary>
      </div>
    </div>
  );
}
