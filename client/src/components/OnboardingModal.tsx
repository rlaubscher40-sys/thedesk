/**
 * Optional product guide. A shared-link recipient sees the evidence first;
 * this dialog opens only when they choose "How it works" in the footer.
 */
import React, { useState } from "react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./ui/Dialog";

export const PRODUCT_GUIDE_ACTIONS = [
  {
    href: "/markets",
    title: "Start with a place",
    body: "Open a market's dated reporting. Compare two markets, see the gaps and save a comparison to revisit on this device.",
  },
  {
    href: "/ask",
    title: "Ask what it means",
    body: "Ask a property question. Get a sourced read, its confidence and what would change the view—or an honest evidence gap.",
  },
  {
    href: "/signals",
    title: "Follow the numbers",
    body: "Inspect the live indicators behind property. Watch a signal from your own baseline and share a number with its context.",
  },
  {
    href: "/",
    title: "Read today's briefing",
    body: "Catch up on the reporting, see why it matters and subscribe to the free daily email when you are ready.",
  },
] as const;

export function OnboardingModal() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="bs-label bs-link">
          How it works
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto">
        <DialogTitle className="font-serif text-3xl leading-tight">
          Make your next property question a better one.
        </DialogTitle>
        <DialogDescription className="text-sm leading-6 text-[var(--color-fg-muted)]">
          Australian property intelligence before it becomes consensus. Start with the evidence,
          then decide what to investigate.
        </DialogDescription>
        <nav aria-label="Product guide" className="rule-hair-b">
          {PRODUCT_GUIDE_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="block rule-hair py-4 bs-row"
              onClick={() => setOpen(false)}
            >
              <p className="font-serif text-xl">{action.title} →</p>
              <p className="text-sm leading-6 text-[var(--color-fg-muted)] mt-2">{action.body}</p>
            </Link>
          ))}
        </nav>
        <p className="text-xs leading-5 text-[var(--color-fg-muted)]">
          Reading is free. Questions and comparisons use your intelligence allowance. Saved watches
          stay on this device; they do not send background alerts.
        </p>
      </DialogContent>
    </Dialog>
  );
}
