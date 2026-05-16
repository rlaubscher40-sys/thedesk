/**
 * Top-level reader for a single edition. Slim because every section is its
 * own component with its own error boundary (issue #3) — see EditionHero,
 * LeadStory, TopicCard, SignalsBriefs, EditionAdminPanel.
 */
import type { Edition } from "@shared/types";
import type { KeyMetrics } from "@shared/schemas";
import { SectionErrorBoundary } from "../ErrorBoundary";
import { ScrollProgress } from "../ScrollProgress";
import { StaggerList } from "../StaggerList";
import { EditionAdminPanel } from "./EditionAdminPanel";
import { EditionHero } from "./EditionHero";
import { LeadStory } from "./LeadStory";
import { SignalsBriefs } from "./SignalsBriefs";
import { TopicCard } from "./TopicCard";

export function EditionReader({
  edition,
  priorMetrics,
}: {
  edition: Edition;
  /** Prior edition's keyMetrics — drives the trend arrows on the
      metrics strip. */
  priorMetrics?: KeyMetrics | null;
}) {
  const topics = edition.topics ?? [];
  const [lead, ...rest] = topics;

  return (
    <article>
      <ScrollProgress />
      <SectionErrorBoundary section="Hero">
        <EditionHero edition={edition} priorMetrics={priorMetrics ?? null} />
      </SectionErrorBoundary>

      {lead && (
        <SectionErrorBoundary section="Lead story">
          <LeadStory topic={lead} />
        </SectionErrorBoundary>
      )}

      {edition.fullText && (
        <section
          className="panel rounded-sm p-8 sm:p-12 lg:p-16 mb-12"
          aria-label="Editor's letter"
        >
          <div className="inline-flex items-center gap-3 mb-6">
            <span
              className="inline-block h-px w-8"
              style={{
                background:
                  "linear-gradient(90deg, var(--color-amber), oklch(0.75 0.18 70 / 20%))",
              }}
              aria-hidden="true"
            />
            <p
              className="overline-amber"
              style={{ letterSpacing: "0.24em", fontSize: "11px" }}
            >
              Editor's letter
            </p>
          </div>
          <div
            className="has-dropcap text-[var(--color-fg-muted)] whitespace-pre-line lg:columns-2"
            style={{
              columnGap: "3rem",
              columnRuleWidth: "1px",
              columnRuleStyle: "solid",
              columnRuleColor: "var(--color-border)",
              columnFill: "balance",
              fontSize: "15.5px",
              lineHeight: "1.75",
            }}
          >
            {edition.fullText}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <SectionErrorBoundary section="Topics">
          <div className="mb-4 flex items-center gap-3">
            <p className="overline-amber" style={{ letterSpacing: "0.2em" }}>
              Topic deck
            </p>
            <span
              className="block flex-1"
              style={{
                height: "1px",
                background:
                  "linear-gradient(90deg, oklch(0.75 0.18 70 / 30%), transparent)",
              }}
              aria-hidden="true"
            />
          </div>
          <StaggerList
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start"
            cacheKey={`edition-${edition.id}`}
          >
            {rest.map((topic, idx) => (
              // The composed key keeps duplicate titles unique (issue #1).
              <TopicCard key={`${topic.title || "topic"}-${idx}`} topic={topic} />
            ))}
          </StaggerList>
        </SectionErrorBoundary>
      )}

      <SectionErrorBoundary section="Signals">
        <SignalsBriefs signals={edition.signals ?? []} />
      </SectionErrorBoundary>

      <SectionErrorBoundary section="Admin panel">
        <EditionAdminPanel edition={edition} />
      </SectionErrorBoundary>
    </article>
  );
}
