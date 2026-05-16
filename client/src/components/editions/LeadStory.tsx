/**
 * The lead story on an Edition reader. Visually crushes the topic-card
 * grid below it — display-2 serif title, italic lede, drop-cap body
 * flowing in two columns on wide screens, talking points inline.
 */
import type { EditionTopic } from "@shared/schemas";
import { cn } from "@/lib/cn";
import { categoryAccentClass, categoryColour } from "@/lib/category";
import { TalkingPointsBlock } from "./TalkingPointsBlock";

export function LeadStory({ topic }: { topic: EditionTopic }) {
  const colour = categoryColour(topic.category);
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
      </div>
    </article>
  );
}
