/**
 * "Ruben on LinkedIn" strip, horizontal scroll of hand-curated LinkedIn
 * posts. Cards link out to the original post. Hidden entirely when
 * there are no live posts so the page doesn't show an empty section.
 *
 * Why hand-curated and not auto-scraped: LinkedIn has no public API for
 * post content and aggressively blocks scrapers. Manual curation is also
 * editorially better, only the posts Ruben thinks are worth surfacing
 * make the strip, which is the whole pitch.
 */
import { ExternalLink, Linkedin } from "lucide-react";
import { trpc } from "@/lib/trpc";

export function LinkedInStrip() {
  const { data: posts, isLoading } = trpc.linkedIn.list.useQuery(
    { limit: 6 },
    { staleTime: 60_000 }
  );

  if (isLoading) return null;
  if (!posts || posts.length === 0) return null;

  return (
    <section>
      <div className="flex items-baseline gap-6 mb-7">
        <span className="inline-flex items-center gap-2">
          <Linkedin className="h-3.5 w-3.5 text-amber-300/80" />
          <span
            className="font-mono uppercase tracking-[0.24em] shrink-0 text-[var(--color-fg-subtle)]"
            style={{ fontSize: "10px" }}
          >
            Ruben on LinkedIn
          </span>
        </span>
        <span
          className="block flex-1 h-px bg-[var(--color-border)]"
          aria-hidden="true"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((post) => (
          <a
            key={post.id}
            href={post.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="panel hover-lift rounded-sm p-5 flex flex-col gap-3 group"
          >
            <p
              className="overline text-[var(--color-fg-subtle)]"
              style={{ letterSpacing: "0.2em" }}
            >
              {post.authorName}
            </p>
            <p className="font-serif text-base leading-relaxed text-[var(--color-fg)] line-clamp-5">
              {post.excerpt}
            </p>
            <span className="mt-auto inline-flex items-center gap-1.5 overline-amber group-hover:text-amber-200 transition-colors">
              <ExternalLink className="h-3 w-3" /> Read on LinkedIn
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
