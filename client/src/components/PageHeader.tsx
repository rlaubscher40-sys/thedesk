import type { ReactNode } from "react";

/**
 * Editorial page header.
 *
 * Single overline + display title + optional kicker. Soft hairline under it.
 * Apple/Aesop register: generous negative space, restrained accent, the
 * type does the work, not chrome around it.
 */
export function PageHeader({
  overline,
  title,
  kicker,
  actions,
}: {
  overline?: string;
  title: string;
  kicker?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-12 lg:mb-16">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="min-w-0 flex-1">
          {overline && (
            <p
              className="overline mb-4 text-[var(--color-fg-subtle)]"
              style={{ letterSpacing: "0.24em" }}
            >
              {overline}
            </p>
          )}
          <h1 className="display-1 max-w-[18ch]">{title}</h1>
          {kicker && (
            <p className="text-base sm:text-lg text-[var(--color-fg-muted)] mt-5 max-w-[68ch] leading-relaxed font-serif italic">
              {kicker}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      <div className="editorial-rule-soft mt-10" aria-hidden="true" />
    </header>
  );
}
