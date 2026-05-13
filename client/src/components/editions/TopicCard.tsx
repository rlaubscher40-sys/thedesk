/**
 * Card for a single edition topic. The first topic on the page is rendered
 * via LeadStory; this is the "rest of the deck" companion.
 */
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { EditionTopic } from "@shared/schemas";
import { cn } from "@/lib/cn";
import { categoryAccentClass } from "@/lib/category";

export function TopicCard({ topic }: { topic: EditionTopic }) {
  const [open, setOpen] = useState(false);
  const hasBody = Boolean(topic.body && topic.body.length > 0);

  return (
    <article
      className={cn(
        "panel panel-hover p-5 rounded transition-colors",
        categoryAccentClass(topic.category)
      )}
    >
      <p className="overline mb-2" style={{ color: "var(--color-amber)" }}>
        {topic.category}
      </p>
      <h3 className="font-serif text-lg leading-snug mb-3">{topic.title}</h3>
      <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed">{topic.summary}</p>

      {topic.keyTakeaway && (
        <p className="text-sm mt-3 pt-3 border-t border-[var(--color-border)]">
          <span className="overline mr-2 inline-block">Takeaway</span>
          {topic.keyTakeaway}
        </p>
      )}

      {hasBody && (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 transition-colors"
            aria-expanded={open}
          >
            <ChevronDown
              className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
            />
            {open ? "Hide deep dive" : "Show deep dive"}
          </button>
          {open && (
            <div className="mt-3 prose-sm max-w-none text-sm text-[var(--color-fg-muted)] leading-relaxed whitespace-pre-line">
              {topic.body}
            </div>
          )}
        </>
      )}

      {topic.whatToWatch && topic.whatToWatch.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
          <p className="overline mb-2">What to watch</p>
          <ul className="space-y-1.5 text-xs text-[var(--color-fg-muted)]">
            {topic.whatToWatch.map((line, idx) => (
              // line is unique most of the time, but a defensive index
              // fallback prevents the React key warning if anything is blank
              // (issue #1 in the brief).
              <li key={line || `watch-${idx}`} className="flex gap-2">
                <span className="text-amber-400/70">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
