/**
 * Common chrome for each right-rail card, overline header + optional
 * footer line + the section's children.
 */
import type { ReactNode } from "react";

export function RailPanel({
  overline,
  footer,
  children,
}: {
  overline: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel rounded-sm p-6">
      <p
        className="overline text-[var(--color-fg-subtle)] mb-5"
        style={{ letterSpacing: "0.24em" }}
      >
        {overline}
      </p>
      {children}
      {footer && (
        <p
          className="overline mt-5 pt-4 border-t border-[var(--color-border)] text-[var(--color-fg-subtle)]"
          style={{ letterSpacing: "0.18em" }}
        >
          {footer}
        </p>
      )}
    </section>
  );
}
