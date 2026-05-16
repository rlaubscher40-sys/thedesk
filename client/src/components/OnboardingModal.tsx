/**
 * 4-step onboarding modal. Shows once per user (tracked in localStorage), or
 * never if dismissed. Keeps state inline — no need for a context.
 */
import { useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "./ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/Dialog";

const STORAGE_KEY = "thedesk:onboarding-seen";

const STEPS = [
  {
    overline: "Step 1 of 4 · Today",
    title: "Today is your morning scan.",
    body: "Five stories curated overnight, each tagged for the four partner personas. Open one to copy a one-liner straight into a client conversation.",
  },
  {
    overline: "Step 2 of 4 · Editions",
    title: "Weekly deep-dive editions.",
    body: "Each Sunday a long-form edition lands with topics, signals and Ruben's Take. The Substack draft sits a click away in the admin panel.",
  },
  {
    overline: "Step 3 of 4 · Reading Queue",
    title: "Save anything for later.",
    body: "Bookmark feed items and external URLs into the Reading Queue. Adding and removing is optimistic — you don't wait for the server.",
  },
  {
    overline: "Step 4 of 4 · Make it yours",
    title: "Notes, tracker, search.",
    body: "Notes per edition. Tracker for every Say This line you used in a conversation. Press / to search anywhere.",
  },
];

export function OnboardingModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
    // Defer so the modal doesn't fight the initial route transition.
    const t = setTimeout(() => setOpen(true), 350);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else dismiss();
  }

  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : dismiss())}>
      <DialogContent className="max-w-md">
        <div className="space-y-3">
          <div className="flex items-center gap-2 overline">
            <Sparkles className="h-3 w-3 text-amber-400" />
            {current.overline}
          </div>
          <DialogTitle className="text-xl font-serif leading-snug">{current.title}</DialogTitle>
          <DialogDescription className="text-sm text-[var(--color-fg-muted)] leading-relaxed">
            {current.body}
          </DialogDescription>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-6 rounded-full transition-colors ${
                  i === step ? "bg-amber-400" : "bg-white/10"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={dismiss}>
              Skip
            </Button>
            <Button variant="primary" size="sm" onClick={next}>
              {isLast ? "Get started" : "Next"} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
