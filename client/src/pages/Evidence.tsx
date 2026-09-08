import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";

export default function Evidence() {
  const [, params] = useRoute("/evidence/:id");
  const id = Number(params?.id);
  const query = trpc.evidence.get.useQuery(
    { id },
    { enabled: Number.isSafeInteger(id) && id > 0, retry: false }
  );
  const item = query.data;
  return (
    <article className="max-w-3xl mx-auto space-y-6 py-8" aria-busy={query.isLoading}>
      <Link href="/ask" className="bs-link">
        Ask The Desk
      </Link>
      {query.isLoading ? (
        <p role="status" className="animate-pulse motion-reduce:animate-none">
          Loading source evidence…
        </p>
      ) : !item ? (
        <p role="alert">This evidence record is unavailable. Try searching again.</p>
      ) : (
        <>
          <p className="bs-label">
            Source evidence · {item.regions.join(" · ") || "Australia / location unspecified"}
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl">{item.title}</h1>
          <p className="text-sm">
            {item.source} · Published {new Date(item.publishedAt).toLocaleDateString("en-AU")}
          </p>
          <p className="text-lg leading-relaxed">
            {item.summary || "This feed supplied a headline only."}
          </p>
          <p className="text-sm text-[var(--color-fg-muted)]">
            This is a public feed excerpt, not a full article or a verified market statistic. Read
            the original for its complete context.
          </p>
          <a
            className="bs-btn bs-btn-solid"
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Read original source
          </a>
          <p>
            <Link
              className="bs-link"
              href={`/ask?q=${encodeURIComponent(item.title.slice(0, 240))}`}
            >
              Ask about this story
            </Link>
          </p>
        </>
      )}
    </article>
  );
}
