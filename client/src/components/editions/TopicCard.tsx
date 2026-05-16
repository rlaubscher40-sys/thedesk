/**
 * Card for a single edition topic. Designed as a proper article, not a
 * preview — the body, key takeaway, talking points and what-to-watch are
 * all visible inline. The whole point of the weekly edition is that
 * readers sit down and read it; hiding the body behind a "Show deep dive"
 * toggle defeated that intent.
 */
import type { EditionTopic } from "@shared/schemas";
import { cn } from "@/lib/cn";
import { categoryAccentClass, categoryColour } from "@/lib/category";
import { TalkingPointsBlock } from "./TalkingPointsBlock";

export function TopicCard({ topic }: { topic: EditionTopic }) {
  const colour = categoryColour(topic.category);
  const hasBody = Boolean(topic.body && topic.body.length > 0);
  const hasWatch = Boolean(topic.whatToWatch && topic.whatToWatch.length > 0);
  const hasTalkingPoints =
    topic.talkingPoints && Object.keys(topic.talkingPoints).length > 0;

  return (
    <article
      className={cn(
        "panel panel-hover rounded p-7 sm:p-8 flex flex-col",
        categoryAccentClass(topic.category)
      )}
      style={{ boxShadow: `inset 3px 0 0 0 ${colour}` }}
    >
      <p
        className="overline-amber mb-3"
        style={{ color: colour, letterSpacing: "0.2em" }}
      >
        {topic.category}
      </p>

      <h3 className="display-3 mb-4 leading-tight">{topic.title}</h3>

      <p className="font-serif italic text-base sm:text-lg text-[var(--color-fg-muted)] leading-relaxed mb-6 max-w-[68ch]">
        {topic.summary}
      </p>

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
    </article>
  );
}
