/**
 * Common chrome for each right-rail card — overline header + optional
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
    <section className="panel rounded p-5">
      <p
        className="overline-amber mb-4"
        style={{ letterSpacing: "0.22em" }}
      >
        {overline}
      </p>
      {children}
      {footer && (
        <p
          className="overline mt-4 pt-4 border-t border-[var(--color-border)] text-[var(--color-fg-subtle)]"
          style={{ letterSpacing: "0.16em" }}
        >
          {footer}
        </p>
      )}
    </section>
  );
}
