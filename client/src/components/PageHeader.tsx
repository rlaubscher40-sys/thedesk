import type { ReactNode } from "react";

/** Editorial-style page header — overline + serif title + optional kicker. */
export function PageHeader({
  overline,
  title,
  kicker,
  actions,
}: {
  overline?: string;
  title: string;
  /** Plain string or a small React fragment for inline links. */
  kicker?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          {overline && <p className="overline mb-2">{overline}</p>}
          <h1 className="font-serif text-3xl sm:text-4xl leading-none">{title}</h1>
          {kicker && (
            <p className="text-sm text-[var(--color-fg-muted)] mt-3 max-w-2xl leading-relaxed">{kicker}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="editorial-rule mt-6" aria-hidden="true" />
    </header>
  );
}
