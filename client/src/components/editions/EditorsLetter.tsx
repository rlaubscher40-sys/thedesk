/**
 * Editor's letter — the 800-1200 word narrative thread that runs across an
 * edition's topics.
 *
 * The redesign's section list for the edition reader doesn't name this
 * block, but it carries real editorial prose (not chrome), so it is kept
 * rather than dropped: a major rule, a section head, and the same
 * two-column measure with a drop cap the lead topic uses. The
 * collapse-on-mobile behaviour and its localStorage key are unchanged.
 */
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { dedash } from "@/lib/dedash";
import { GUTTER_X } from "@/components/broadsheet/tokens";

const STORAGE_KEY = "thedesk:editors-letter-expanded";

function readInitialExpanded(): boolean {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "1") return true;
  if (stored === "0") return false;
  return window.innerWidth >= 768;
}

export function EditorsLetter({ fullText }: { fullText: string }) {
  const [expanded, setExpanded] = useState<boolean>(readInitialExpanded);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, expanded ? "1" : "0");
  }, [expanded]);

  // Word-count hint when collapsed so the reader knows what they're
  // skipping. Cheap split, good enough for the header.
  const minutes = Math.max(1, Math.round(fullText.trim().split(/\s+/).length / 220));
  const paragraphs = fullText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <section className={cn(GUTTER_X, "rule-major mt-11 pt-5")} aria-label="Editor's letter">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="editors-letter-body"
        className="bs-link flex w-full items-baseline justify-between gap-4 text-left"
      >
        <span className="bs-label" style={{ letterSpacing: "0.24em" }}>
          Editor&apos;s letter
        </span>
        <span className="bs-label">
          {expanded ? "Collapse" : `${minutes} min read · Read →`}
        </span>
      </button>

      {expanded && (
        <div id="editors-letter-body" className="bs-columns has-dropcap mt-6">
          {paragraphs.map((para, i) => (
            <p
              key={i}
              style={{
                fontSize: 16.5,
                lineHeight: 1.75,
                color: "var(--color-fg-body)",
                margin: "0 0 18px 0",
              }}
            >
              {dedash(para)}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
