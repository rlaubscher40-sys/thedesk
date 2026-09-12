import { Link } from "wouter";

type Story = { id: number; title: string; source: string; sourceUrl: string | null };
export function RelatedCoverage({ groups }: { groups: Array<{ lead: Story; related: Story[] }> }) {
  const related = groups.filter((group) => group.related.length);
  if (!related.length) return null;
  return (
    <section
      className="px-6 md:px-10 py-6 border-t border-[var(--color-rule)]"
      aria-label="More reporting on these stories"
    >
      <h2 className="font-semibold">More reporting on these stories</h2>
      <p className="text-sm mt-2 text-[var(--color-fg-muted)]">
        Related reports and follow-ups, with every original story available.
      </p>
      {related.map(({ lead, related: reports }) => (
        <details key={lead.id} className="py-3 border-b border-[var(--color-rule)]">
          <summary className="cursor-pointer text-sm">
            <span className="font-medium">{lead.title}</span> · {reports.length} related{" "}
            {reports.length === 1 ? "report" : "reports"}
          </summary>
          <ul className="mt-3 space-y-3 text-sm">
            {reports.map((story) => (
              <li key={story.id}>
                <Link href={`/story/${story.id}`} className="underline underline-offset-2">
                  {story.title}
                </Link>
                <span className="block text-xs mt-1">
                  {story.source}
                  {story.sourceUrl && (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={story.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Original reporting
                      </a>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  );
}
