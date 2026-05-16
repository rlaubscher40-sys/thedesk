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
import { SubscribeCallout } from "../SubscribeCallout";
import { EditionAdminPanel } from "./EditionAdminPanel";
import { EditionHero } from "./EditionHero";
import { EditorsLetter } from "./EditorsLetter";
import { LeadStory } from "./LeadStory";
import { ListenButton } from "./ListenButton";
import { SignalsBriefs } from "./SignalsBriefs";
import { TopicCard } from "./TopicCard";

/**
 * Flatten an edition into a plain-text script the browser's SpeechSynthesis
 * can read end-to-end. Keeps the natural reading order: take, letter, lead,
 * each topic in turn. Signals + dates are skipped — they're scannable, not
 * listenable.
 */
function buildAudioScript(edition: Edition): string {
  const parts: string[] = [];
  parts.push(`Edition ${edition.editionNumber}. ${edition.weekRange}.`);
  if (edition.rubensTake) parts.push(`Ruben's take. ${edition.rubensTake}`);
  if (edition.fullText) parts.push(edition.fullText);
  for (const topic of edition.topics ?? []) {
    parts.push(`${topic.category}. ${topic.title}.`);
    if (topic.summary) parts.push(topic.summary);
    if (topic.body) parts.push(topic.body);
    if (topic.keyTakeaway) parts.push(`Key takeaway. ${topic.keyTakeaway}`);
  }
  return parts.join("\n\n");
}

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
  const audioScript = buildAudioScript(edition);

  return (
    <article>
      <ScrollProgress />
      <SectionErrorBoundary section="Hero">
        <EditionHero edition={edition} priorMetrics={priorMetrics ?? null} />
      </SectionErrorBoundary>

      <div className="flex justify-end -mt-6 mb-8">
        <ListenButton text={audioScript} />
      </div>

      {lead && (
        <SectionErrorBoundary section="Lead story">
          <LeadStory topic={lead} editionId={edition.id} topicIndex={0} />
        </SectionErrorBoundary>
      )}

      {edition.fullText && (
        <SectionErrorBoundary section="Editor's letter">
          <EditorsLetter fullText={edition.fullText} />
        </SectionErrorBoundary>
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
              // topicIndex is +1 because the lead is at array position 0.
              <TopicCard
                key={`${topic.title || "topic"}-${idx}`}
                topic={topic}
                editionId={edition.id}
                topicIndex={idx + 1}
              />
            ))}
          </StaggerList>
        </SectionErrorBoundary>
      )}

      <SectionErrorBoundary section="Signals">
        <SignalsBriefs signals={edition.signals ?? []} />
      </SectionErrorBoundary>

      {edition.datesToWatch && edition.datesToWatch.length > 0 && (
        <SectionErrorBoundary section="Dates to watch">
          <section className="mt-12">
            <div className="mb-5 flex items-center gap-3">
              <p className="overline-amber" style={{ letterSpacing: "0.22em" }}>
                Dates to watch
              </p>
              <span
                className="block flex-1 h-px bg-[var(--color-border)]"
                aria-hidden="true"
              />
            </div>
            <ul className="space-y-3">
              {edition.datesToWatch.map((d, idx) => (
                <li
                  key={`${d.label}-${idx}`}
                  // On mobile the date label sits above the description
                  // (single column). On sm+ they side-by-side with the
                  // date column shrunk from 100px to 78px to free space.
                  className="panel rounded-sm p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-[78px_minmax(0,1fr)] items-start gap-2 sm:gap-5"
                >
                  <span
                    className="font-mono uppercase tracking-[0.18em] text-amber-300"
                    style={{ fontSize: "11px" }}
                  >
                    {d.label}
                  </span>
                  <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed">
                    {d.description}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </SectionErrorBoundary>
      )}

      {/* End-of-read Subscribe panel. Highest-conversion surface in the
          product — the reader has just spent 10 minutes with the editor's
          voice, so the offer to keep getting it lands at the right moment. */}
      <SectionErrorBoundary section="Subscribe">
        <div className="mt-16 mb-12">
          <SubscribeCallout source="edition-foot" variant="edition" />
        </div>
      </SectionErrorBoundary>

      <SectionErrorBoundary section="Admin panel">
        <EditionAdminPanel edition={edition} />
      </SectionErrorBoundary>
    </article>
  );
}
