/**
 * The lead story on an Edition reader. Visually crushes the topic-card
 * grid below it — display-2 serif title, italic lede, drop-cap body
 * flowing in two columns on wide screens, talking points inline.
 *
 * Expanded by default (it's the lead — readers come for it), but the
 * deep dive can be collapsed by tapping the toggle for readers who only
 * want the headline + lede pass.
 */
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { EditionTopic } from "@shared/schemas";
import { cn } from "@/lib/cn";
import { categoryAccentClass, categoryColour } from "@/lib/category";
import { TalkingPointsBlock } from "./TalkingPointsBlock";

export function LeadStory({ topic }: { topic: EditionTopic }) {
  const [expanded, setExpanded] = useState(true);
  const colour = categoryColour(topic.category);
  const hasBody = Boolean(topic.body);
  const hasWatch = Boolean(topic.whatToWatch && topic.whatToWatch.length > 0);
  const hasTalkingPoints =
    topic.talkingPoints && Object.keys(topic.talkingPoints).length > 0;
  const hasDeepDive =
    hasBody || hasWatch || hasTalkingPoints || Boolean(topic.keyTakeaway);

  return (
    <article
      className={cn(
        "panel rounded-sm mb-12 relative overflow-hidden",
        categoryAccentClass(topic.category)
      )}
      style={{ boxShadow: `inset 3px 0 0 0 ${colour}` }}
    >
      <div className="p-8 sm:p-12 lg:p-16">
        {/* Editorial badge — slim gold rule + small mono label. */}
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
            Lead story <span className="text-[var(--color-fg-subtle)] mx-1.5">·</span>{" "}
            {topic.category}
          </p>
        </div>

        {/* Display-2 title — bounded width so the line wraps editorially
            rather than running 120ch wide. */}
        <h2 className="display-2 mb-7 max-w-[26ch]">{topic.title}</h2>

        {/* Italic serif lede. */}
        <p className="font-serif italic text-xl sm:text-2xl text-[var(--color-fg-muted)] leading-relaxed mb-8 max-w-[68ch]">
          {topic.summary}
        </p>

        {topic.whyItMatters && (
          <div
            className="mb-8 px-5 py-4 rounded-sm border-l-2 max-w-[68ch]"
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
            <p className="text-[15.5px] text-[var(--color-fg)] leading-relaxed">
              {topic.whyItMatters}
            </p>
          </div>
        )}

        {expanded && (
          <>
            {/* Body — two text columns on lg+, with a column rule and drop-cap
                on the first paragraph. The column rule lifts the page off a
                generic "long paragraph" feel and into broadsheet register. */}
            {topic.body && (
              <div
                className="has-dropcap text-[var(--color-fg-muted)] leading-relaxed whitespace-pre-line lg:columns-2"
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
                {topic.body}
              </div>
            )}

            {/* Key takeaway — full-width band, separator above. */}
            {topic.keyTakeaway && (
              <div className="mt-10 pt-7 border-t border-[var(--color-border)]">
                <p
                  className="overline-amber mb-3"
                  style={{ letterSpacing: "0.24em" }}
                >
                  Key takeaway
                </p>
                <p className="font-serif text-lg text-[var(--color-fg)] leading-relaxed max-w-[68ch]">
                  {topic.keyTakeaway}
                </p>
              </div>
            )}

            {/* Talking points inline. */}
            {topic.talkingPoints && Object.keys(topic.talkingPoints).length > 0 && (
              <TalkingPointsBlock points={topic.talkingPoints} />
            )}

            {/* What to watch — bottom strip, 2 columns on sm+. */}
            {topic.whatToWatch && topic.whatToWatch.length > 0 && (
              <div className="mt-10 pt-7 border-t border-[var(--color-border)]">
                <p
                  className="overline mb-4"
                  style={{ letterSpacing: "0.24em" }}
                >
                  What to watch
                </p>
                <ul className="grid sm:grid-cols-2 gap-x-12 gap-y-3 text-[15px] text-[var(--color-fg-muted)]">
                  {topic.whatToWatch.filter(Boolean).map((line, idx) => (
                    <li
                      key={line || `lead-watch-${idx}`}
                      className="flex gap-3 leading-relaxed"
                    >
                      <span className="text-amber-400/60 shrink-0 mt-0.5">▸</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {hasDeepDive && (
          <div className="mt-10 pt-6 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="inline-flex items-center gap-1.5 rounded px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.18em] transition-colors"
              style={{
                background: `${colour}12`,
                boxShadow: `inset 0 0 0 1px ${colour}40`,
                color: colour,
              }}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Collapse deep dive
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Read deep dive
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
