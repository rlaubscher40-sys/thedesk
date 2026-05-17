/**
 * Floating feedback affordance. Sits bottom-right on every page during
 * the partner-testing window. Tap opens a small modal with a kind
 * picker (Bug / Idea / Praise), a message textarea, an optional email
 * field for follow-up, and an optional reporter label so the admin
 * knows who's sending what without a sign-in wall.
 *
 * On submit the page URL + user-agent are captured automatically so
 * the admin can repro from the same surface the tester saw.
 *
 * Hidden on the /admin route (the admin doesn't need to file bugs to
 * themselves) and on the /login + /confirm-subscription chrome-light
 * pages.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  Bug,
  Heart,
  Lightbulb,
  MessageSquarePlus,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Honeypot } from "@/components/Honeypot";
import { cn } from "@/lib/cn";
import { trpc } from "@/lib/trpc";

type Kind = "bug" | "idea" | "praise";

const STORAGE_LABEL_KEY = "thedesk:feedback-reporter-label";

const KIND_OPTIONS: Array<{
  key: Kind;
  label: string;
  description: string;
  icon: typeof Bug;
  colour: string;
}> = [
  {
    key: "bug",
    label: "Bug",
    description: "Something's broken or looks wrong",
    icon: Bug,
    colour: "oklch(0.68 0.20 15)",
  },
  {
    key: "idea",
    label: "Idea",
    description: "Suggest a feature or improvement",
    icon: Lightbulb,
    colour: "oklch(0.78 0.18 70)",
  },
  {
    key: "praise",
    label: "Praise",
    description: "Tell Ruben what's working",
    icon: Heart,
    colour: "oklch(0.72 0.17 155)",
  },
];

const HIDDEN_ROUTES = ["/admin", "/login", "/confirm-subscription"];

export function FeedbackButton() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  // Don't render on routes that are admin-only or pre-auth.
  const hidden = HIDDEN_ROUTES.some((p) => location.startsWith(p));
  if (hidden) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        title="Send feedback"
        className="fixed z-40 bottom-24 right-4 lg:bottom-6 lg:right-6 inline-flex items-center gap-2 rounded-full pl-3 pr-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.18em] transition-all active:scale-[0.96] shadow-lg"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.78 0.18 70) 0%, oklch(0.88 0.19 82) 55%, oklch(0.65 0.16 60) 100%)",
          color: "oklch(0.10 0.018 260)",
          boxShadow: "0 8px 24px oklch(0.75 0.18 70 / 35%)",
        }}
      >
        <MessageSquarePlus className="h-3.5 w-3.5" strokeWidth={2.5} />
        Feedback
      </button>
      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  );
}

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<Kind>("bug");
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [hp, setHp] = useState("");
  const [reporterLabel, setReporterLabel] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(STORAGE_LABEL_KEY) ?? "";
  });

  // Persist the reporter label so a tester only types their name once.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_LABEL_KEY, reporterLabel);
  }, [reporterLabel]);

  // Close on Esc.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = trpc.feedback.submit.useMutation({
    onSuccess: () => {
      toast.success("Thanks — Ruben sees this");
      setMessage("");
      onClose();
    },
    onError: () => toast.error("Couldn't send — try again in a sec"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) {
      toast.error("Add a message first");
      return;
    }
    submit.mutate({
      kind,
      message: message.trim(),
      _hp: hp,
      pageUrl: typeof window !== "undefined" ? window.location.href : null,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      contactEmail: contactEmail.trim() || null,
      reporterLabel: reporterLabel.trim() || null,
    });
  }

  const activeMeta = KIND_OPTIONS.find((k) => k.key === kind)!;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Send feedback"
        className="fixed z-50 inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[440px] panel rounded-sm overflow-hidden"
        style={{ background: "var(--grad-panel-soft)" }}
      >
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--color-border)]">
          <div>
            <p
              className="overline-amber"
              style={{ letterSpacing: "0.22em", fontSize: "10px" }}
            >
              Tell Ruben
            </p>
            <p className="font-serif text-lg font-bold leading-tight mt-0.5">
              Feedback
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-white/5"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <Honeypot value={hp} onChange={setHp} />
          {/* Kind picker. */}
          <div>
            <p
              className="overline mb-2 text-[var(--color-fg-subtle)]"
              style={{ letterSpacing: "0.18em", fontSize: "10px" }}
            >
              Kind
            </p>
            <div className="grid grid-cols-3 gap-2">
              {KIND_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = kind === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setKind(opt.key)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-sm p-2.5 transition-all text-left",
                      active && "ring-1 ring-amber-400/60"
                    )}
                    style={{
                      background: active
                        ? `${opt.colour}18`
                        : "oklch(1 0 0 / 2%)",
                      boxShadow: active
                        ? `inset 0 0 0 1px ${opt.colour}55`
                        : "inset 0 0 0 1px var(--color-border)",
                    }}
                  >
                    <Icon
                      className="h-3.5 w-3.5 mb-1.5"
                      style={{ color: active ? opt.colour : "var(--color-fg-muted)" }}
                    />
                    <p
                      className="font-mono uppercase"
                      style={{
                        color: active ? opt.colour : "var(--color-fg)",
                        fontSize: "10px",
                        letterSpacing: "0.16em",
                      }}
                    >
                      {opt.label}
                    </p>
                  </button>
                );
              })}
            </div>
            <p
              className="text-[11px] text-[var(--color-fg-subtle)] mt-2 leading-relaxed"
              style={{ color: `${activeMeta.colour}cc` }}
            >
              {activeMeta.description}
            </p>
          </div>

          {/* Message. */}
          <label className="block">
            <span
              className="overline mb-1.5 block text-[var(--color-fg-subtle)]"
              style={{ letterSpacing: "0.18em", fontSize: "10px" }}
            >
              Message
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={2000}
              required
              placeholder={
                kind === "bug"
                  ? "What broke? What were you doing when it broke?"
                  : kind === "idea"
                    ? "What would make this more useful for partner conversations?"
                    : "What's working for you?"
              }
              className="w-full px-3 py-2 rounded text-sm bg-black/20 border border-[var(--color-border)] focus:outline-none focus:border-amber-400/40 transition-colors leading-relaxed"
            />
          </label>

          {/* Reporter + email. */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-3">
            <label className="block">
              <span
                className="overline mb-1.5 block text-[var(--color-fg-subtle)]"
                style={{ letterSpacing: "0.18em", fontSize: "10px" }}
              >
                Your name (optional)
              </span>
              <input
                type="text"
                value={reporterLabel}
                onChange={(e) => setReporterLabel(e.target.value)}
                maxLength={128}
                placeholder="Sarah B."
                className="w-full px-3 py-2 rounded text-sm bg-black/20 border border-[var(--color-border)] focus:outline-none focus:border-amber-400/40 transition-colors"
              />
            </label>
            <label className="block">
              <span
                className="overline mb-1.5 block text-[var(--color-fg-subtle)]"
                style={{ letterSpacing: "0.18em", fontSize: "10px" }}
              >
                Email if you want a reply
              </span>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                maxLength={320}
                placeholder="you@firm.com"
                className="w-full px-3 py-2 rounded text-sm bg-black/20 border border-[var(--color-border)] focus:outline-none focus:border-amber-400/40 transition-colors"
              />
            </label>
          </div>

          <p
            className="flex items-start gap-1.5 text-[10px] text-[var(--color-fg-subtle)] leading-relaxed"
          >
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-400/60" />
            <span>
              We capture the page URL and your browser type so Ruben can
              reproduce. Nothing else — no tracking pixels.
            </span>
          </p>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded text-[10px] font-mono uppercase tracking-[0.18em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submit.isPending}
              className="inline-flex items-center gap-1.5 rounded px-4 py-2 text-[10px] font-mono uppercase tracking-[0.18em] transition-all active:scale-[0.98] disabled:opacity-50"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.78 0.18 70) 0%, oklch(0.88 0.19 82) 55%, oklch(0.65 0.16 60) 100%)",
                color: "oklch(0.10 0.018 260)",
              }}
            >
              <Send className="h-3 w-3" />
              {submit.isPending ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
