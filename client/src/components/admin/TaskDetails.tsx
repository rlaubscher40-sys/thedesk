import { useState, type ReactNode } from "react";
export function TaskDetails({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="mt-7" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="bs-link min-h-11 py-3 font-semibold">{title}</summary>
      {open && children}
    </details>
  );
}
