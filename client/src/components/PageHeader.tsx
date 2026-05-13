import type { ReactNode } from "react";

/**
 * Editorial page header.
 *
 * Overline (mono, amber) → display-1 serif title → optional kicker. The
 * `editorial-rule` underline glows amber and is the brand's defining visual
 * element, so it sits as part of the header rather than being added by each
 * page.
 */
export function PageHeader({
  overline,
  title,
  kicker,
  actions,
}: {
  overline?: string;
  title: string;
  /** Plain string or a small fragment for inline links. */
  kicker?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-10">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          {overline && <p className="overline-amber mb-3">{overline}</p>}
          <h1 className="display-1">{title}</h1>
          {kicker && (
            <p className="text-base text-[var(--color-fg-muted)] mt-4 max-w-2xl leading-relaxed">
              {kicker}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      <div className="editorial-rule-soft mt-8" aria-hidden="true" />
    </header>
  );
}
