/**
 * Card for a single edition topic. Designed as a proper article, not a
 * preview — but collapsible: by default only the headline, italic summary
 * and "why it matters" hook show, with a button to expand the full deep
 * dive (body, key takeaway, what to watch, talking points). Keeps the
 * topic deck scannable without losing the long-form value.
 */
import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil } from "lucide-react";
import type { EditionTopic } from "@shared/schemas";
import { cn } from "@/lib/cn";
import { categoryAccentClass, categoryColour } from "@/lib/category";
import { useAuth } from "@/lib/useAuth";
import { TalkingPointsBlock } from "./TalkingPointsBlock";
import { TopicEditDrawer } from "./TopicEditDrawer";

export function TopicCard({
  topic,
  editionId,
  topicIndex,
}: {
  topic: EditionTopic;
  editionId?: number;
  topicIndex?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const { user } = useAuth();
  const canEdit =
    user?.role === "admin" && editionId != null && topicIndex != null;
  const colour = categoryColour(topic.category);
  const hasBody = Boolean(topic.body && topic.body.length > 0);
  const hasWatch = Boolean(topic.whatToWatch && topic.whatToWatch.length > 0);
  const hasTalkingPoints =
    topic.talkingPoints && Object.keys(topic.talkingPoints).length > 0;
  const hasDeepDive =
    hasBody || hasWatch || hasTalkingPoints || Boolean(topic.keyTakeaway);

  return (
    <article
      className={cn(
        "panel panel-hover rounded p-7 sm:p-8 flex flex-col",
        categoryAccentClass(topic.category)
      )}
      style={{ boxShadow: `inset 3px 0 0 0 ${colour}` }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <p
          className="overline-amber"
          style={{ color: colour, letterSpacing: "0.2em" }}
        >
          {topic.category}
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
            aria-label="Edit topic"
            title="Edit topic"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <h3 className="display-3 mb-4 leading-tight">{topic.title}</h3>

      <p className="font-serif italic text-base sm:text-lg text-[var(--color-fg-muted)] leading-relaxed mb-6 max-w-[68ch]">
        {topic.summary}
      </p>

      {topic.whyItMatters && (
        <div
          className="mb-6 px-5 py-4 rounded-sm border-l-2 max-w-[68ch]"
          style={{
            borderLeftColor: colour,
            background: `${colour}08`,
          }}
        >
          <p
            className="overline mb-1.5"
            style={{
              color: colour,
              letterSpacing: "0.22em",
              fontSize: "9px",
            }}
          >
            Why this matters
          </p>
          <p className="text-[15px] text-[var(--color-fg)] leading-relaxed">
            {topic.whyItMatters}
          </p>
        </div>
      )}

      {/* Deep dive — collapsed by default. The summary + whyItMatters give
          the reader enough to decide whether to expand. */}
      {expanded && (
        <>
          {hasBody && (
            <div
              className="text-[var(--color-fg-muted)] leading-relaxed whitespace-pre-line max-w-[68ch] mb-6"
              style={{ fontSize: "15px", lineHeight: "1.75" }}
            >
              {topic.body}
            </div>
          )}

          {topic.keyTakeaway && (
            <div
              className="mt-2 mb-6 p-4 rounded-sm"
              style={{
                background: `${colour}0a`,
                boxShadow: `inset 0 0 0 1px ${colour}22`,
              }}
            >
              <p
                className="overline-amber mb-2"
                style={{ color: colour, letterSpacing: "0.22em", fontSize: "10px" }}
              >
                Key takeaway
              </p>
              <p className="font-serif text-base text-[var(--color-fg)] leading-relaxed">
                {topic.keyTakeaway}
              </p>
            </div>
          )}

          {hasWatch && (
            <div className="mt-2 mb-6 pt-5 border-t border-[var(--color-border)]">
              <p
                className="overline mb-3"
                style={{ letterSpacing: "0.2em" }}
              >
                What to watch
              </p>
              <ul className="space-y-2 text-sm text-[var(--color-fg-muted)]">
                {topic.whatToWatch!.map((line, idx) => (
                  <li key={line || `watch-${idx}`} className="flex gap-3">
                    <span className="text-amber-400/70 shrink-0 mt-0.5">▸</span>
                    <span className="leading-relaxed">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasTalkingPoints && (
            <div className="mt-2 pt-5 border-t border-[var(--color-border)]">
              <TalkingPointsBlock points={topic.talkingPoints!} />
            </div>
          )}
        </>
      )}

      {hasDeepDive && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-auto self-start inline-flex items-center gap-1.5 rounded px-3.5 py-2 text-[10px] font-mono uppercase tracking-[0.18em] transition-colors"
          style={{
            background: `${colour}10`,
            boxShadow: `inset 0 0 0 1px ${colour}40`,
            color: colour,
          }}
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Collapse
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Read deep dive
            </>
          )}
        </button>
      )}

      {canEdit && (
        <TopicEditDrawer
          open={editing}
          onClose={() => setEditing(false)}
          editionId={editionId!}
          topicIndex={topicIndex!}
          topic={topic}
        />
      )}
    </article>
  );
}
