/**
 * Editor's letter, the 800-1200 word narrative thread that runs across an
 * edition's topics. Collapsed by default on mobile so the lead and topic
 * deck land sooner; expanded by default on desktop where the two-column
 * broadsheet layout actually earns its room. Choice persists in
 * localStorage so the reader's preference sticks across visits.
 */
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

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
  const wordCount = fullText.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(wordCount / 220));

  return (
    <section
      className="panel rounded-sm mb-12 overflow-hidden"
      aria-label="Editor's letter"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="editors-letter-body"
        className="w-full text-left flex items-center justify-between gap-4 px-8 sm:px-12 lg:px-16 py-6 hover:bg-white/[0.02] transition-colors"
      >
        <div className="inline-flex items-center gap-3 flex-wrap">
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
            Editor's letter
          </p>
          {!expanded && (
            <span
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]"
            >
              {minutes} min read
            </span>
          )}
        </div>
        <ChevronDown
          className="h-3.5 w-3.5 text-[var(--color-fg-subtle)] shrink-0 transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "none" }}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div
          id="editors-letter-body"
          className="px-8 sm:px-12 lg:px-16 pb-8 sm:pb-12 lg:pb-16"
        >
          <div
            className="has-dropcap text-[var(--color-fg-muted)] whitespace-pre-line lg:columns-2"
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
            {fullText}
          </div>
        </div>
      )}
    </section>
  );
}
