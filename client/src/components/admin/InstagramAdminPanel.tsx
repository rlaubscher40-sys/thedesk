import { Eye } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/Skeleton";

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString();
}

/**
 * Dry-run preview: render the exact cards that would post (daily or latest
 * weekly) from live data and show them, without publishing or recording.
 */
function PreviewBlock() {
  const preview = trpc.instagram.preview.useMutation({
    onError: (err) => toast.error(err.message || "Preview failed"),
  });
  const result = preview.data;
  const pendingKind = preview.isPending ? preview.variables?.kind : null;

  const btnBase =
    "inline-flex items-center gap-1.5 rounded px-3.5 py-2 text-xs font-mono uppercase tracking-[0.14em] transition-all active:scale-[0.98] disabled:opacity-50";

  return (
    <div className="space-y-4">
      <div>
        <p className="overline-amber mb-2" style={{ letterSpacing: "0.22em", fontSize: "10px" }}>
          Dry run
        </p>
        <h2 className="font-serif text-2xl font-bold leading-tight">Preview a post</h2>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1.5 max-w-[60ch]">
          Renders the exact cards that would post — from today's feed or the latest
          weekly edition — without publishing or recording anything. The cover, theme
          and metrics are faithful; story-card subtext uses the stored copy (no live
          headline rewrite).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => preview.mutate({ kind: "daily" })}
          disabled={preview.isPending}
          className={btnBase}
          style={{ background: "var(--grad-cta-amber)", color: "var(--color-on-amber)" }}
        >
          <Eye className="h-3 w-3" />
          {pendingKind === "daily" ? "Rendering…" : "Preview today's daily"}
        </button>
        <button
          type="button"
          onClick={() => preview.mutate({ kind: "weekly" })}
          disabled={preview.isPending}
          className={`${btnBase} border border-[var(--color-border-strong)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]`}
        >
          <Eye className="h-3 w-3" />
          {pendingKind === "weekly" ? "Rendering…" : "Preview latest weekly"}
        </button>
        {result?.variant && (
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300 border border-amber-500/40 rounded px-2 py-1">
            Next cover · {result.variant}
          </span>
        )}
      </div>

      {preview.isPending ? (
        <Skeleton className="h-48 w-full rounded" />
      ) : result ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {result.slides.map((s) => (
              <figure key={s.label} className="space-y-1.5">
                <img
                  src={s.dataUri}
                  alt={s.label}
                  loading="lazy"
                  className="w-full rounded border border-[var(--color-border)]"
                />
                <figcaption className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
                  {s.label}
                </figcaption>
              </figure>
            ))}
          </div>
          <details className="rounded border border-[var(--color-border)] bg-white/[0.02] p-3">
            <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
              Caption
            </summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-[var(--color-fg-muted)] leading-relaxed">
              {result.caption}
            </pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}

export function InstagramAdminPanel() {
  const { data, isLoading } = trpc.instagram.listAll.useQuery();
  const posts = data ?? [];

  return (
    <section className="panel rounded p-6 sm:p-8 space-y-8">
      <PreviewBlock />

      <div className="border-t border-[var(--color-border)] pt-6">
        <p className="overline-amber mb-2" style={{ letterSpacing: "0.22em", fontSize: "10px" }}>
          Ruben on Instagram
        </p>
        <h2 className="font-serif text-2xl font-bold leading-tight">Published posts</h2>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1.5 max-w-[60ch]">
          Read-only log of every feed post with engagement metrics fetched from the Instagram Insights API.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded" />
      ) : posts.length === 0 ? (
        <p className="text-sm text-[var(--color-fg-muted)]">No posts recorded yet.</p>
      ) : (
        <div className="overflow-x-auto -mx-6 sm:-mx-8 px-6 sm:px-8">
          <table className="w-full text-xs border-collapse min-w-[680px]">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                {["Date", "Type", "Headline", "Likes", "Comments", "Reach", "Saved", "Shares"].map(
                  (h) => (
                    <th
                      key={h}
                      className="pb-2 text-left font-mono uppercase tracking-[0.16em] text-[var(--color-fg-subtle)] pr-4 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr
                  key={p.mediaId}
                  className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-2.5 pr-4 font-mono tabular-nums text-[var(--color-fg-muted)] whitespace-nowrap">
                    {p.feedDate ?? (p.editionNumber != null ? `Ed. ${p.editionNumber}` : "—")}
                  </td>
                  <td className="py-2.5 pr-4 font-mono uppercase tracking-[0.12em] text-[var(--color-fg-subtle)] whitespace-nowrap">
                    {p.postType}
                  </td>
                  <td className="py-2.5 pr-4 max-w-[260px] truncate text-[var(--color-fg)]">
                    {p.headline ?? "—"}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums text-right text-[var(--color-fg-muted)]">
                    {fmt(p.likes)}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums text-right text-[var(--color-fg-muted)]">
                    {fmt(p.comments)}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums text-right text-[var(--color-fg-muted)]">
                    {fmt(p.reach)}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums text-right text-[var(--color-fg-muted)]">
                    {fmt(p.saved)}
                  </td>
                  <td className="py-2.5 tabular-nums text-right text-[var(--color-fg-muted)]">
                    {fmt(p.shares)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
