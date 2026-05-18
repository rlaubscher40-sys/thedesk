/**
 * Feedback inbox for the admin. Lists every submission newest-first
 * with kind / message / page / reporter / status. Each row has
 * mark-reviewed and delete actions. Default filter shows new + reviewed;
 * a tab control lets the admin scope to just new or just reviewed.
 */
import { useState } from "react";
import {
  Bug,
  Check,
  ExternalLink,
  Heart,
  Lightbulb,
  Mail,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import type { FeedbackSubmission } from "@shared/types";
import { cn } from "@/lib/cn";
import { trpc } from "@/lib/trpc";

type Filter = "all" | "new" | "reviewed";

const KIND_META: Record<
  string,
  { label: string; icon: typeof Bug; colour: string }
> = {
  bug: { label: "Bug", icon: Bug, colour: "oklch(0.68 0.20 15)" },
  idea: { label: "Idea", icon: Lightbulb, colour: "oklch(0.78 0.18 70)" },
  praise: { label: "Praise", icon: Heart, colour: "oklch(0.72 0.17 155)" },
};

export function FeedbackAdminPanel() {
  const [filter, setFilter] = useState<Filter>("all");
  const utils = trpc.useUtils();
  const listQuery = trpc.feedback.list.useQuery();

  const setStatus = trpc.feedback.setStatus.useMutation({
    onSuccess: () => {
      utils.feedback.list.invalidate();
      utils.feedback.newCount.invalidate();
    },
    onError: () => toast.error("Couldn't update"),
  });
  const remove = trpc.feedback.delete.useMutation({
    onSuccess: () => {
      utils.feedback.list.invalidate();
      utils.feedback.newCount.invalidate();
      toast.success("Removed");
    },
    onError: () => toast.error("Couldn't delete"),
  });

  const all = listQuery.data ?? [];
  const visible =
    filter === "all" ? all : all.filter((f) => f.status === filter);
  const newCount = all.filter((f) => f.status === "new").length;

  return (
    <section className="panel rounded p-6 sm:p-8 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p
            className="overline-amber mb-2"
            style={{ letterSpacing: "0.22em", fontSize: "10px" }}
          >
            Feedback inbox
          </p>
          <h2 className="font-serif text-2xl font-bold leading-tight">
            What partners are saying
          </h2>
          <p className="text-sm text-[var(--color-fg-muted)] mt-1.5 max-w-[60ch]">
            Submissions from the floating feedback button on every reader-
            facing page. {newCount > 0 ? `${newCount} new` : "Nothing new"}.
          </p>
        </div>
        <div className="inline-flex rounded-sm border border-[var(--color-border)] p-0.5">
          {(["all", "new", "reviewed"] as const).map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-sm text-[10px] font-mono uppercase tracking-[0.18em] transition-colors",
                  active
                    ? "bg-amber-500/15 text-amber-200"
                    : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                )}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-[var(--color-fg-muted)] py-6">
          {all.length === 0
            ? "No submissions yet. Share the link with partners and the inbox will fill in."
            : "Nothing matches this filter."}
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((row) => (
            <FeedbackRow
              key={row.id}
              row={row}
              onMarkReviewed={() =>
                setStatus.mutate({
                  id: row.id,
                  status: row.status === "new" ? "reviewed" : "new",
                })
              }
              onDelete={() => {
                if (confirm("Delete this submission?")) remove.mutate({ id: row.id });
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function FeedbackRow({
  row,
  onMarkReviewed,
  onDelete,
}: {
  row: FeedbackSubmission;
  onMarkReviewed: () => void;
  onDelete: () => void;
}) {
  const meta = KIND_META[row.kind] ?? KIND_META.idea!;
  const Icon = meta.icon;
  const isNew = row.status === "new";
  return (
    <li
      className="panel rounded p-4 grid grid-cols-[44px_minmax(0,1fr)_auto] gap-4 items-start"
      style={{
        boxShadow: isNew ? `inset 3px 0 0 0 ${meta.colour}` : undefined,
      }}
    >
      <span
        className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: `${meta.colour}18`,
          boxShadow: `inset 0 0 0 1px ${meta.colour}55`,
        }}
      >
        <Icon className="h-4 w-4" style={{ color: meta.colour }} />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span
            className="overline-amber"
            style={{ color: meta.colour, letterSpacing: "0.18em", fontSize: "10px" }}
          >
            {meta.label}
          </span>
          {row.reporterLabel && (
            <span className="overline text-[var(--color-fg-subtle)]">
              {row.reporterLabel}
            </span>
          )}
          <span className="overline text-[var(--color-fg-subtle)]">
            {formatTime(row.createdAt)}
          </span>
          {isNew && (
            <span
              className="font-mono uppercase tracking-[0.18em] rounded-sm px-1.5 py-0.5"
              style={{
                fontSize: "10px",
                background: "oklch(0.78 0.18 70 / 18%)",
                color: "oklch(0.92 0.18 80)",
              }}
            >
              New
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-line">
          {row.message}
        </p>
        <div className="flex items-center gap-3 flex-wrap mt-2.5">
          {row.pageUrl && (
            <a
              href={row.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 overline text-[var(--color-fg-subtle)] hover:text-amber-300 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              {shortPath(row.pageUrl)}
            </a>
          )}
          {row.contactEmail && (
            <a
              href={`mailto:${row.contactEmail}?subject=Re%3A%20your%20feedback%20on%20The%20Desk`}
              className="inline-flex items-center gap-1 overline text-[var(--color-fg-subtle)] hover:text-amber-300 transition-colors"
              title={row.contactEmail}
            >
              <Mail className="h-3 w-3" />
              {row.contactEmail}
            </a>
          )}
          {row.userAgent && (
            <span
              className="overline text-[var(--color-fg-subtle)] truncate max-w-[40ch]"
              title={row.userAgent}
            >
              {shortUserAgent(row.userAgent)}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <button
          onClick={onMarkReviewed}
          aria-label={isNew ? "Mark reviewed" : "Mark new"}
          title={isNew ? "Mark reviewed" : "Move back to new"}
          className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-amber-300 transition-colors"
        >
          {isNew ? <Check className="h-3.5 w-3.5" /> : <Undo2 className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={onDelete}
          aria-label="Delete"
          className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-red-400 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

function shortPath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}` || "/";
  } catch {
    return url.slice(0, 64);
  }
}

function shortUserAgent(ua: string): string {
  // Coarse browser-family extraction, enough for the admin to know
  // "iOS Safari" vs "Chrome desktop" at a glance.
  if (/iPhone|iPad/.test(ua)) return "iOS Safari";
  if (/Android/.test(ua)) return "Android";
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox/.test(ua)) return "Firefox";
  if (/Safari/.test(ua)) return "Safari";
  return ua.slice(0, 40);
}

function formatTime(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
