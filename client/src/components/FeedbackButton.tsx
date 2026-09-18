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
  Newspaper,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Honeypot } from "@/components/Honeypot";
import { cn } from "@/lib/cn";
import { trpc } from "@/lib/trpc";
import { preferenceStorage } from "@/lib/storage";
import { feedbackPageUrl } from "@shared/feedbackPageUrl";
import {
  READER_TASKS,
  REQUEST_GEOGRAPHIES,
  REQUEST_PRIVACY_NOTICE,
  REQUEST_TOPICS,
  type ReaderTask,
  type RequestGeography,
  type RequestTopic,
} from "@shared/readerRequests";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./ui/Dialog";

type Kind = "bug" | "idea" | "praise" | "coverage";

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
  {
    key: "coverage",
    label: "Cover this",
    description: "Ask The Desk to report or research something",
    icon: Newspaper,
    colour: "oklch(0.74 0.14 250)",
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          aria-label="Send feedback"
          title="Send feedback"
          className="fixed z-40 right-4 lg:right-6 inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full p-3 lg:pl-3 lg:pr-4 lg:py-2.5 text-[10px] font-mono uppercase tracking-[0.18em] transition-all active:scale-[0.96] shadow-lg bottom-[var(--overlay-bottom)]"
          style={{
            // Mobile: a compact icon-only disc, 88px clearance above the
            // bottom tab bar (z-50, ~70px tall with safe-area). The full
            // labelled pill only shows lg+, where the tab bar isn't
            // rendered and there's room in the corner — on phones the
            // wide pill kept overlapping feed content.
            background: "var(--grad-cta-amber)",
            color: "var(--color-on-amber)",
            boxShadow: "0 8px 24px var(--color-amber-glow)",
          }}
        >
          <MessageSquarePlus className="h-3.5 w-3.5" strokeWidth={2.5} />
          <span className="hidden lg:inline">Feedback</span>
        </button>
      </DialogTrigger>
      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </Dialog>
  );
}

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<Kind>("bug");
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [hp, setHp] = useState("");
  const [reporterLabel, setReporterLabel] = useState("");
  const [topic, setTopic] = useState<RequestTopic>("supply");
  const [geography, setGeography] = useState<RequestGeography>("national");
  const [readerTask, setReaderTask] = useState<ReaderTask>("watching");
  const coverage = kind === "coverage";

  // Retire the previous automatic name persistence on shared devices.
  useEffect(() => {
    preferenceStorage.removeItem(STORAGE_LABEL_KEY);
  }, []);

  const submit = trpc.feedback.submit.useMutation({
    onSuccess: () => {
      toast.success(coverage ? "Request received. Editors read every one." : "Thanks, Ruben sees this");
      setMessage("");
      onClose();
    },
    onError: () => toast.error("Couldn't send. Try again in a moment."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 3) {
      toast.error("Add a message of at least 3 characters");
      return;
    }
    submit.mutate({
      kind,
      message: message.trim(),
      _hp: hp,
      pageUrl: typeof window !== "undefined" ? feedbackPageUrl(window.location.href) : null,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      contactEmail: contactEmail.trim() || null,
      reporterLabel: reporterLabel.trim() || null,
      ...(coverage ? { topic, geography, readerTask } : {}),
    });
  }

  const activeMeta = KIND_OPTIONS.find((k) => k.key === kind)!;

  return (
    <DialogContent
      fitVisibleViewport
      aria-modal="true"
      className="max-w-[440px] block p-0"
      style={{ background: "var(--grad-panel-soft)" }}
    >
      <header className="px-5 pr-16 py-4 border-b border-[var(--color-border)]">
        <div>
          <p className="overline-amber" style={{ letterSpacing: "0.22em", fontSize: "10px" }}>
            Tell Ruben
          </p>
          <DialogTitle className="font-serif text-lg font-bold leading-tight mt-0.5">
            Send feedback
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-[var(--color-fg-muted)]">
            {coverage
              ? "Ask The Desk to report or research something. Editors read every request."
              : "Report a problem or suggest an improvement. Leave out private or sensitive information."}
          </DialogDescription>
        </div>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                    background: active ? `${opt.colour}18` : "oklch(1 0 0 / 2%)",
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

        {/* Coverage requests carry three fixed categories so editorial triage can
            group them. Never free text: a second free-text field is a second
            place a reader could put someone's name or address. */}
        {coverage && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(
              [
                ["Topic", topic, setTopic, REQUEST_TOPICS],
                ["Where", geography, setGeography, REQUEST_GEOGRAPHIES],
                ["You are", readerTask, setReaderTask, READER_TASKS],
              ] as const
            ).map(([label, value, set, options]) => (
              <label key={label} className="block">
                <span
                  className="overline mb-1.5 block text-[var(--color-fg-subtle)]"
                  style={{ letterSpacing: "0.18em", fontSize: "10px" }}
                >
                  {label}
                </span>
                <select
                  value={value}
                  onChange={(event) => (set as (next: string) => void)(event.target.value)}
                  className="w-full min-h-11 px-3 py-2 rounded text-sm bg-[var(--color-bg-deep)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-amber)]/50 transition-colors"
                >
                  {options.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}

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
                  ? "What would make this more useful to you?"
                  : coverage
                    ? "What should The Desk look into, and what decision would the answer help you make?"
                    : "What's working for you?"
            }
            className="w-full px-3 py-2 rounded text-sm bg-[var(--color-bg-deep)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-amber)]/50 transition-colors leading-relaxed"
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
              className="w-full px-3 py-2 rounded text-sm bg-[var(--color-bg-deep)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-amber)]/50 transition-colors"
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
              placeholder="you@example.com"
              className="w-full px-3 py-2 rounded text-sm bg-[var(--color-bg-deep)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-amber)]/50 transition-colors"
            />
          </label>
        </div>

        <p className="flex items-start gap-1.5 text-[10px] text-[var(--color-fg-subtle)] leading-relaxed">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-400/60" />
          <span>
            {coverage ? `${REQUEST_PRIVACY_NOTICE} ` : ""}
            We include the page address without query parameters and your browser type with your
            message. Your name and reply email are optional and are not used to subscribe you to
            marketing.{" "}
            <a href="/privacy" className="underline">
              Privacy notice
            </a>
            .
          </span>
        </p>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 px-3.5 py-2 rounded text-xs font-mono uppercase tracking-[0.18em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submit.isPending}
            className="inline-flex min-h-11 items-center gap-1.5 rounded px-4 py-2 text-xs font-mono uppercase tracking-[0.18em] transition-all active:scale-[0.98] disabled:opacity-50"
            style={{
              background: "var(--grad-cta-amber)",
              color: "var(--color-on-amber)",
            }}
          >
            <Send className="h-3 w-3" />
            {submit.isPending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </DialogContent>
  );
}
