/**
 * "Show context" expander — when expanded reveals an analyst note in
 * mono type. aria-expanded toggles for assistive tech. The note panel
 * animates open with a CSS max-height transition.
 */
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export function ContextExpander({ note }: { note: string }) {
  const [open, setOpen] = useState(false);
  const id = `ctx-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="inline-flex items-center gap-1.5 overline-amber hover:text-amber-200 transition-colors"
      >
        <ChevronDown
          className={cn("h-3 w-3 transition-transform duration-200", open && "rotate-180")}
        />
        {open ? "Hide context" : "Show context"}
      </button>
      <div
        id={id}
        className="overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-out"
        style={{
          maxHeight: open ? 800 : 0,
          opacity: open ? 1 : 0,
          marginTop: open ? 12 : 0,
        }}
        aria-hidden={!open}
      >
        <div
          className="p-3.5 rounded border border-[var(--color-border)] bg-[var(--color-panel-tile-bg)] text-xs leading-relaxed font-mono text-[var(--color-fg-muted)]"
          style={{ letterSpacing: "0.01em" }}
        >
          {note}
        </div>
      </div>
    </div>
  );
}
