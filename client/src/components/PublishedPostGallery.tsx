import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { trackEvent } from "@/lib/analytics";
function Cover({ src, title }: { src: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <img
      src={src}
      alt={`Published post: ${title}`}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className="aspect-[4/5] w-full object-contain"
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="aspect-[4/5] p-5 flex items-center border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
      <p className="font-serif text-xl">
        {title}
        <span className="block font-sans text-xs mt-3 text-[var(--color-fg-muted)]">
          Published thumbnail unavailable
        </span>
      </p>
    </div>
  );
}
export function PublishedPostGallery() {
  const query = trpc.instagram.publishedGallery.useQuery(undefined, {
    staleTime: 5 * 60_000,
    retry: 1,
  });
  if (query.isLoading)
    return (
      <p role="status" className="py-6">
        Loading recent published posts…
      </p>
    );
  if (query.isError)
    return (
      <p role="status" className="py-6">
        Recent posts could not load.{" "}
        <button className="underline min-h-11" onClick={() => void query.refetch()}>
          Try again
        </button>
        , or choose a topic below.
      </p>
    );
  if (!query.data?.length) return null;
  return (
    <section className="mt-6" aria-label="Recent published posts">
      <h2 className="font-serif text-2xl">Find the post you watched</h2>
      <p className="text-sm mt-2 text-[var(--color-fg-muted)]">
        Open its evidence below. Data pages show the latest observations; compare their reference
        period with the original post.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-5">
        {query.data.map((post) => (
          <article key={post.id} className="min-w-0 rule-hair-b pb-4">
            <a href={post.links[0]!.path} onClick={() => trackEvent("social_open", "social")}>
              <Cover src={post.thumbnail} title={post.title} />
            </a>
            <p className="bs-label mt-3">
              {post.format} ·{" "}
              {new Date(post.publishedAt).toLocaleDateString("en-AU", {
                timeZone: "Australia/Sydney",
                day: "numeric",
                month: "short",
              })}
            </p>
            <h3 className="font-serif text-xl mt-2">{post.title}</h3>
            {post.reference && (
              <p className="text-xs mt-2">Source reference when published: {post.reference}</p>
            )}
            <div className="flex flex-wrap gap-x-4 mt-2">
              {post.links.map((link) => (
                <a
                  key={link.path}
                  href={link.path}
                  className="bs-link min-h-11 inline-flex items-center text-sm underline"
                >
                  {link.title} →
                </a>
              ))}
              {post.permalink && (
                <a
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bs-link min-h-11 inline-flex items-center text-sm"
                >
                  View original post ↗
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
