/**
 * Card for a single edition topic. Visually smaller than LeadStory so the
 * hierarchy on the EditionReader is obvious. Body / "what to watch" sit
 * behind an expand toggle to keep the grid scannable.
 */
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { EditionTopic } from "@shared/schemas";
import { cn } from "@/lib/cn";
import { categoryAccentClass, categoryColour } from "@/lib/category";
import { TalkingPointsBlock } from "./TalkingPointsBlock";

export function TopicCard({ topic }: { topic: EditionTopic }) {
  const [open, setOpen] = useState(false);
  const hasBody = Boolean(topic.body && topic.body.length > 0);

  return (
    <article
      className={cn(
        "panel panel-hover hover-lift p-6 rounded flex flex-col",
        categoryAccentClass(topic.category)
      )}
    >
      <p
        className="overline-amber mb-3"
        style={{ color: categoryColour(topic.category) }}
      >
        {topic.category}
      </p>
      <h3 className="display-3 mb-3 leading-tight">{topic.title}</h3>
      <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed flex-1">
        {topic.summary}
      </p>

      {topic.keyTakeaway && (
        <p className="text-sm mt-4 pt-4 border-t border-[var(--color-border)] leading-relaxed">
          <span className="overline-amber mr-2 inline-block">Takeaway</span>
          <span className="text-[var(--color-fg)]">{topic.keyTakeaway}</span>
        </p>
      )}

      {hasBody && (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="mt-4 inline-flex items-center gap-1.5 self-start overline-amber hover:text-amber-300 transition-colors"
            aria-expanded={open}
          >
            <ChevronDown
              className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
            />
            {open ? "Hide deep dive" : "Show deep dive"}
          </button>
          {open && (
            <div className="mt-3 text-sm text-[var(--color-fg-muted)] leading-relaxed whitespace-pre-line border-t border-[var(--color-border)] pt-4">
              {topic.body}
            </div>
          )}
        </>
      )}

      {topic.whatToWatch && topic.whatToWatch.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
          <p className="overline mb-2">What to watch</p>
          <ul className="space-y-1.5 text-xs text-[var(--color-fg-muted)]">
            {topic.whatToWatch.map((line, idx) => (
              <li key={line || `watch-${idx}`} className="flex gap-2">
                <span className="text-amber-400/60 shrink-0">▸</span>
                <span className="leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {topic.talkingPoints && Object.keys(topic.talkingPoints).length > 0 && (
        <TalkingPointsBlock points={topic.talkingPoints} />
      )}
    </article>
  );
}
