/**
 * Broadsheet page title block.
 *
 * Kicker, headline and standfirst on the left; optional stat cells in
 * hairline-divided columns on the right. This is the pattern the Archive
 * title block established — extracted here so Trends and the Reading
 * Queue don't each re-derive it, and so the old `PageHeader` (a panel
 * with a gradient rule under it) can retire from reader-facing pages.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { GUTTER_X } from "./tokens";

export type TitleStat = { label: string; value: string };

export function PageTitle({
  kicker,
  title,
  standfirst,
  stats = [],
  actions,
  className,
}: {
  kicker: string;
  title: string;
  standfirst?: string;
  /** Right-hand figures, rendered as hairline-divided cells. */
  stats?: TitleStat[];
  /** Buttons that belong with the title (e.g. "Mark all read"). */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(GUTTER_X, "pt-9", className)}>
      <div className="flex items-end justify-between gap-10 flex-wrap">
        <div className="min-w-0">
          <p className="bs-label-accent" style={{ letterSpacing: "0.24em" }}>
            {kicker}
          </p>
          <h1
            className="font-serif font-bold mt-3.5"
            style={{
              fontSize: "clamp(36px, 4.6vw, 64px)",
              lineHeight: 0.94,
              letterSpacing: "-0.03em",
            }}
          >
            {title}
          </h1>
          {standfirst && (
            <p
              className="font-serif mt-3.5 max-w-[52ch]"
              style={{ fontSize: 21, lineHeight: 1.42, color: "var(--color-fg-muted)" }}
            >
              {standfirst}
            </p>
          )}
        </div>

        {(stats.length > 0 || actions) && (
          <div className="flex items-end gap-6 shrink-0">
            {actions}
            {stats.length > 0 && (
              <div className="hidden md:flex rule-hair-l">
                {stats.map((s, i) => (
                  <div
                    key={s.label}
                    className={cn("px-6 text-right", i > 0 && "rule-hair-l")}
                  >
                    <p className="bs-label" style={{ letterSpacing: "0.2em" }}>
                      {s.label}
                    </p>
                    <p
                      className="font-serif font-bold tabular-nums mt-2"
                      style={{ fontSize: 30, lineHeight: 1 }}
                    >
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A section head: a major rule, the mono label, and an optional
 * right-aligned note. The broadsheet's only section divider.
 */
export function SectionHead({
  label,
  note,
  className,
}: {
  label: string;
  note?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        GUTTER_X,
        "rule-major mt-11 pt-5 flex items-baseline justify-between gap-4 flex-wrap",
        className
      )}
    >
      <p className="bs-label" style={{ letterSpacing: "0.24em" }}>
        {label}
      </p>
      {note && <p className="bs-label">{note}</p>}
    </div>
  );
}
