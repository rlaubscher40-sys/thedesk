import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/Skeleton";

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString();
}

export function InstagramAdminPanel() {
  const { data, isLoading } = trpc.instagram.listAll.useQuery();
  const posts = data ?? [];

  return (
    <section className="panel rounded p-6 sm:p-8 space-y-6">
      <div>
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
