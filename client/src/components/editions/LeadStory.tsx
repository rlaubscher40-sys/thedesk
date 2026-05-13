/**
 * The lead story on an Edition reader. Visually crushes the topic-card grid
 * below it — display-2 serif title, large body type, drop-cap on the lead
 * paragraph, talking points inline rather than collapsed.
 */
import type { EditionTopic } from "@shared/schemas";
import { cn } from "@/lib/cn";
import { categoryAccentClass } from "@/lib/category";
import { TalkingPointsBlock } from "./TalkingPointsBlock";

export function LeadStory({ topic }: { topic: EditionTopic }) {
  return (
    <article
      className={cn(
        "panel rounded p-7 sm:p-10 mb-10 relative",
        categoryAccentClass(topic.category)
      )}
    >
      {/* Editorial badge — amber gold, mono uppercase. */}
      <div className="inline-flex items-center gap-2 mb-5">
        <span
          className="inline-block"
          style={{
            width: "16px",
            height: "1.5px",
            background:
              "linear-gradient(90deg, var(--color-amber), oklch(0.75 0.18 70 / 20%))",
            borderRadius: "999px",
          }}
        />
        <p className="overline-amber" style={{ letterSpacing: "0.18em" }}>
          Lead story · {topic.category}
        </p>
      </div>

      {/* Display-2 scale title — visibly bigger than topic cards' display-3. */}
      <h2 className="display-2 mb-6 max-w-4xl">{topic.title}</h2>

      {/* Lead summary in larger serif, italic. */}
      <p className="font-serif italic text-lg sm:text-xl text-[var(--color-fg-muted)] leading-relaxed max-w-3xl mb-6">
        {topic.summary}
      </p>

      {/* Body — drop cap on first paragraph for editorial weight. */}
      {topic.body && (
        <div className="has-dropcap text-[var(--color-fg-muted)] leading-relaxed whitespace-pre-line max-w-3xl">
          {topic.body}
        </div>
      )}

      {/* Key takeaway — separator + amber overline + foreground line. */}
      {topic.keyTakeaway && (
        <div className="mt-7 pt-5 border-t border-[var(--color-border)] max-w-3xl">
          <p className="overline-amber mb-2">Key takeaway</p>
          <p className="text-base text-[var(--color-fg)] leading-relaxed">
            {topic.keyTakeaway}
          </p>
        </div>
      )}

      {/* Talking points inline so the user doesn't have to expand them. */}
      {topic.talkingPoints && Object.keys(topic.talkingPoints).length > 0 && (
        <TalkingPointsBlock points={topic.talkingPoints} />
      )}

      {/* What to watch — final block. */}
      {topic.whatToWatch && topic.whatToWatch.length > 0 && (
        <div className="mt-7 pt-5 border-t border-[var(--color-border)] max-w-3xl">
          <p className="overline mb-3">What to watch</p>
          <ul className="space-y-2 text-sm text-[var(--color-fg-muted)]">
            {topic.whatToWatch.filter(Boolean).map((line, idx) => (
              <li key={line || `lead-watch-${idx}`} className="flex gap-3">
                <span className="text-amber-400/70 shrink-0 mt-0.5">▸</span>
                <span className="leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
