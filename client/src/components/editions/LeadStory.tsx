/**
 * The lead story on an Edition reader. Visually distinct from regular topic
 * cards — wider, with the talking points block expanded inline so the user
 * doesn't have to click to see them.
 */
import type { EditionTopic } from "@shared/schemas";
import { cn } from "@/lib/cn";
import { categoryAccentClass } from "@/lib/category";
import { TalkingPointsBlock } from "./TalkingPointsBlock";

export function LeadStory({ topic }: { topic: EditionTopic }) {
  return (
    <article
      className={cn(
        "panel rounded p-6 sm:p-8 mb-8 transition-colors",
        categoryAccentClass(topic.category)
      )}
    >
      <p className="overline mb-3" style={{ color: "var(--color-amber)" }}>
        Lead story · {topic.category}
      </p>
      <h2 className="font-serif text-2xl sm:text-3xl leading-tight mb-4">{topic.title}</h2>
      <p className="text-base text-[var(--color-fg-muted)] leading-relaxed">{topic.summary}</p>

      {topic.body && (
        <div className="mt-5 text-[var(--color-fg-muted)] leading-relaxed whitespace-pre-line">
          {topic.body}
        </div>
      )}

      {topic.keyTakeaway && (
        <div className="mt-5 pt-4 border-t border-[var(--color-border)]">
          <p className="overline mb-1.5">Key takeaway</p>
          <p className="text-[var(--color-fg)]">{topic.keyTakeaway}</p>
        </div>
      )}

      {topic.talkingPoints && Object.keys(topic.talkingPoints).length > 0 && (
        <TalkingPointsBlock points={topic.talkingPoints} />
      )}

      {topic.whatToWatch && topic.whatToWatch.length > 0 && (
        <div className="mt-5 pt-4 border-t border-[var(--color-border)]">
          <p className="overline mb-2">What to watch</p>
          <ul className="space-y-1.5 text-sm text-[var(--color-fg-muted)]">
            {topic.whatToWatch.filter(Boolean).map((line, idx) => (
              <li key={line || `lead-watch-${idx}`} className="flex gap-2">
                <span className="text-amber-400/70 shrink-0">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
