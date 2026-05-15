/**
 * Admin panel for managing the "Ruben on LinkedIn" strip.
 *
 * Add: paste a LinkedIn post URL + the excerpt to surface on cards.
 * List: shows every entry (live + hidden) with toggle / delete / reorder
 * controls. Lives in the /admin page; non-admins can't see the queries.
 */
import { useState } from "react";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export function LinkedInAdminPanel() {
  const utils = trpc.useUtils();
  const listQuery = trpc.linkedIn.listAll.useQuery();

  const [postUrl, setPostUrl] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [displayOrder, setDisplayOrder] = useState("100");

  const add = trpc.linkedIn.add.useMutation({
    onSuccess: () => {
      setPostUrl("");
      setExcerpt("");
      setDisplayOrder("100");
      toast.success("Featured post added");
      utils.linkedIn.listAll.invalidate();
      utils.linkedIn.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "Couldn't add — check the URL"),
  });

  const update = trpc.linkedIn.update.useMutation({
    onSuccess: () => {
      utils.linkedIn.listAll.invalidate();
      utils.linkedIn.list.invalidate();
    },
  });

  const remove = trpc.linkedIn.remove.useMutation({
    onSuccess: () => {
      toast.success("Removed");
      utils.linkedIn.listAll.invalidate();
      utils.linkedIn.list.invalidate();
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!postUrl.trim() || !excerpt.trim()) {
      toast.error("URL and excerpt are both required");
      return;
    }
    add.mutate({
      postUrl: postUrl.trim(),
      excerpt: excerpt.trim(),
      displayOrder: Number(displayOrder) || 100,
    });
  }

  const posts = listQuery.data ?? [];

  return (
    <section className="panel rounded p-6 sm:p-8 space-y-6">
      <div>
        <p className="overline-amber mb-2" style={{ letterSpacing: "0.22em", fontSize: "10px" }}>
          Ruben on LinkedIn
        </p>
        <h2 className="font-serif text-2xl font-bold leading-tight">Featured posts</h2>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1.5 max-w-[60ch]">
          Paste LinkedIn post URLs you want surfaced on the Today page. Lower display order shows first.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
          <input
            type="url"
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
            placeholder="https://www.linkedin.com/posts/..."
            required
            className="px-3 py-2 rounded text-sm bg-black/20 border border-[var(--color-border)] focus:outline-none focus:border-amber-400/40 transition-colors"
            aria-label="LinkedIn post URL"
          />
          <input
            type="number"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            min={0}
            max={9999}
            placeholder="Order"
            className="px-3 py-2 rounded text-sm bg-black/20 border border-[var(--color-border)] focus:outline-none focus:border-amber-400/40 transition-colors"
            aria-label="Display order"
          />
        </div>
        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          rows={3}
          placeholder="Excerpt — 1-3 sentences from the post body."
          required
          className="w-full px-3 py-2 rounded text-sm bg-black/20 border border-[var(--color-border)] focus:outline-none focus:border-amber-400/40 transition-colors"
          aria-label="Post excerpt"
        />
        <button
          type="submit"
          disabled={add.isPending}
          className="inline-flex items-center gap-1.5 rounded px-3.5 py-2 text-[10px] font-mono uppercase tracking-[0.18em] transition-all active:scale-[0.98] disabled:opacity-50"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.78 0.18 70) 0%, oklch(0.88 0.19 82) 55%, oklch(0.65 0.16 60) 100%)",
            color: "oklch(0.10 0.018 260)",
            boxShadow: "0 4px 14px oklch(0.75 0.18 70 / 25%)",
          }}
        >
          <Plus className="h-3 w-3" />
          {add.isPending ? "Adding…" : "Add post"}
        </button>
      </form>

      <div className="border-t border-[var(--color-border)] pt-5">
        <p className="overline mb-3" style={{ letterSpacing: "0.18em" }}>
          {posts.length === 0 ? "No posts yet" : `${posts.length} post${posts.length === 1 ? "" : "s"}`}
        </p>
        {posts.length > 0 && (
          <ul className="space-y-2">
            {posts.map((post) => (
              <li
                key={post.id}
                className="grid grid-cols-[48px_1fr_auto] items-center gap-4 p-3 rounded bg-black/20 border border-[var(--color-border)]"
              >
                <span className="font-mono tabular-nums text-[var(--color-fg-subtle)] text-xs">
                  {post.displayOrder}
                </span>
                <div className="min-w-0">
                  <a
                    href={post.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="overline-amber hover:text-amber-200 transition-colors block truncate"
                  >
                    {post.postUrl}
                  </a>
                  <p className="text-xs text-[var(--color-fg-muted)] mt-1 line-clamp-2 leading-snug">
                    {post.excerpt}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => update.mutate({ id: post.id, isLive: !post.isLive })}
                    aria-label={post.isLive ? "Hide post" : "Show post"}
                    className="p-1.5 rounded text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-white/5"
                  >
                    {post.isLive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this featured post?")) remove.mutate({ id: post.id });
                    }}
                    aria-label="Delete post"
                    className="p-1.5 rounded text-[var(--color-fg-muted)] hover:text-red-300 hover:bg-white/5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
