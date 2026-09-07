import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "wouter";
import {
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  Search,
  Share2,
  ShieldCheck,
} from "lucide-react";
import { ShareIntelligenceCardButton } from "@/components/ask/ShareIntelligenceCardButton";
import { GUTTER_X } from "@/components/broadsheet/tokens";
import { Skeleton } from "@/components/ui/Skeleton";
import { getLoginUrl } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/useAuth";

const EXAMPLES = [
  "What is changing in investor lending?",
  "What does The Desk know about Townsville?",
  "What is the case against the current property consensus?",
  "What has changed in housing supply recently?",
];

const HISTORY_KEY = "thedesk:ask-history";
const MAX_HISTORY = 5;

function readHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function rememberQuestion(question: string): void {
  if (typeof window === "undefined") return;
  const next = [question, ...readHistory().filter((item) => item !== question)].slice(0, MAX_HISTORY);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

export default function AskDeskPage() {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mutation = trpc.ask.answer.useMutation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    setHistory(readHistory());
    if (typeof window !== "undefined" && window.innerWidth >= 768) inputRef.current?.focus();
  }, []);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const value = question.trim();
    if (value.length < 3 || mutation.isPending) return;
    setCopied(false);
    rememberQuestion(value);
    setHistory(readHistory());
    mutation.mutate({ question: value });
  }

  function ask(value: string) {
    setQuestion(value);
    setCopied(false);
    rememberQuestion(value);
    setHistory(readHistory());
    mutation.mutate({ question: value });
  }

  const result = mutation.data;

  async function copyBrief() {
    if (!result || result.status !== "answered") return;
    const a = result.answer;
    const text = [
      a.headline,
      "",
      a.answer,
      "",
      `WHY IT MATTERS\n${a.whyItMatters}`,
      "",
      `THE DESK TAKE\n${a.deskTake}`,
      "",
      `WHAT WOULD CHANGE OUR MIND\n${a.whatWouldChangeOurMind}`,
      "",
      `Sources: ${result.sources.map((source) => source.title).join(" · ")}`,
      "",
      "The Desk · Australian property intelligence",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard is unavailable on some non-secure local previews.
    }
  }

  async function shareBrief() {
    if (!result || result.status !== "answered") return;
    const text = `${result.answer.headline}\n\n${result.answer.answer}\n\nThe Desk`;
    if (navigator.share) {
      try {
        await navigator.share({ title: result.answer.headline, text, url: window.location.href });
        return;
      } catch {
        // User cancelled or Web Share is unavailable for this payload.
      }
    }
    await copyBrief();
  }

  return (
    <div className={cn(GUTTER_X, "pt-9 pb-16")}>
      <header className="max-w-[1180px]">
        <p className="bs-label-accent" style={{ letterSpacing: "0.24em" }}>
          The Desk · Intelligence terminal
        </p>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-8 lg:gap-14 items-end mt-3.5">
          <div>
            <h1
              className="font-serif font-bold"
              style={{
                fontSize: "clamp(44px, 7vw, 92px)",
                lineHeight: 0.9,
                letterSpacing: "-0.045em",
              }}
            >
              Ask The Desk.
            </h1>
            <p
              className="font-serif mt-5 max-w-[58ch]"
              style={{
                fontSize: "clamp(19px, 2.1vw, 27px)",
                lineHeight: 1.35,
                color: "var(--color-fg-muted)",
              }}
            >
              Ask a property question. The Desk cross-references its own reporting and returns a
              sourced intelligence brief, not a generic AI answer.
            </p>
          </div>
          <div className="rule-major pt-4 lg:pt-5">
            <p className="bs-label">Grounding standard</p>
            <p className="mt-2 text-[15px] leading-6 text-[var(--color-fg-body)]">
              Answers are constrained to evidence already inside The Desk. When the archive cannot
              support a claim, it should say so.
            </p>
          </div>
        </div>
      </header>

      <form onSubmit={submit} className="rule-major rule-hair-b mt-10 lg:mt-12">
        <label htmlFor="ask-desk" className="sr-only">
          Ask The Desk a property intelligence question
        </label>
        <div className="flex items-end gap-3 py-4 lg:py-5">
          <Search
            className="h-6 w-6 mb-2.5 shrink-0 text-[var(--color-fg-muted)]"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <textarea
            ref={inputRef}
            id="ask-desk"
            rows={1}
            value={question}
            maxLength={240}
            onChange={(event) => {
              setQuestion(event.target.value);
              event.currentTarget.style.height = "auto";
              event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 180)}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="What do you need to know about Australian property?"
            className="flex-1 min-w-0 resize-none overflow-hidden bg-transparent border-0 outline-none font-serif"
            style={{
              minHeight: 48,
              fontSize: "clamp(24px, 3.8vw, 44px)",
              lineHeight: 1.12,
              color: "var(--color-fg)",
              caretColor: "var(--color-accent-text)",
            }}
          />
          <button
            type="submit"
            disabled={question.trim().length < 3 || mutation.isPending}
            aria-label="Ask The Desk"
            className="h-12 w-12 lg:h-14 lg:w-14 shrink-0 flex items-center justify-center bs-btn-solid disabled:opacity-30"
            style={{ borderRadius: 2 }}
          >
            <ArrowUp className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </div>
      </form>

      {!authLoading && !isAuthenticated && (
        <div className="rule-hair-b py-4 flex flex-wrap items-center justify-between gap-4">
          <p className="text-[14px] text-[var(--color-fg-muted)]">
            No account required · 3 grounded intelligence questions free each day.
          </p>
          <a href={getLoginUrl()} className="bs-label bs-link">
            Sign in for unlimited Ask →
          </a>
        </div>
      )}

      {!result && !mutation.isPending && (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_1px_320px] mt-7">
          <section className="lg:pr-14">
            <p className="bs-label">Try asking</p>
            <div className="mt-3 rule-hair-b">
              {EXAMPLES.map((example, index) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => ask(example)}
                  className="w-full text-left py-4 rule-hair bs-row group flex items-start justify-between gap-5"
                >
                  <span
                    className="font-serif group-hover:text-[var(--color-accent-text)] transition-colors"
                    style={{ fontSize: "clamp(20px, 2.4vw, 30px)", lineHeight: 1.2 }}
                  >
                    {example}
                  </span>
                  <span className="bs-label mt-1 tabular-nums">0{index + 1}</span>
                </button>
              ))}
            </div>
          </section>
          <div className="hidden lg:block bg-[var(--color-border)]" />
          <aside className="lg:pl-9 mt-9 lg:mt-0">
            <p className="bs-label">How it works</p>
            <div className="mt-4 space-y-5">
              <ProcessStep number="01" title="Retrieve" body="Find the reporting and editions that actually bear on the question." />
              <ProcessStep number="02" title="Cross-check" body="Separate archive facts from The Desk's interpretation and uncertainty." />
              <ProcessStep number="03" title="Brief" body="Return the answer, why it matters, the take, and what would change the view." />
            </div>
            {history.length > 0 && (
              <div className="rule-hair mt-8 pt-5">
                <p className="bs-label">Recent questions</p>
                <div className="mt-3 space-y-2.5">
                  {history.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => ask(item)}
                      className="block text-left text-sm leading-5 bs-link text-[var(--color-fg-muted)]"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {mutation.isPending && <ThinkingState question={question.trim()} />}

      {mutation.isError && (
        <div className="rule-major mt-10 pt-6 max-w-3xl">
          <p className="bs-label-accent">Intelligence request failed</p>
          <h2 className="font-serif text-3xl mt-2">The Desk could not finish that answer.</h2>
          <p className="mt-3 text-[var(--color-fg-body)]">{mutation.error.message}</p>
          <div className="flex flex-wrap gap-2 mt-5">
            <button type="button" onClick={() => mutation.reset()} className="bs-btn bs-btn-outline">
              Try another question
            </button>
            {!isAuthenticated && (
              <a href={getLoginUrl()} className="bs-btn bs-btn-solid">
                Sign in
              </a>
            )}
          </div>
        </div>
      )}

      {result?.status === "insufficient" && (
        <div className="rule-major mt-10 pt-6 max-w-3xl">
          <p className="bs-label-accent">Evidence threshold not met</p>
          <h2
            className="font-serif font-bold mt-2"
            style={{ fontSize: "clamp(31px, 4vw, 50px)", lineHeight: 1.02 }}
          >
            Not enough signal yet.
          </h2>
          <p className="font-serif mt-4 text-xl leading-8 text-[var(--color-fg-body)]">
            {result.message}
          </p>
          <Link href="/archive" className="bs-btn bs-btn-outline inline-block mt-6">
            Search the archive
          </Link>
        </div>
      )}

      {result?.status === "answered" && (
        <article className="mt-10 lg:mt-12 animate-fade-in">
          <div className="rule-major pt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <ShieldCheck className="h-4 w-4 text-[var(--color-accent-text)]" />
              <p className="bs-label-accent">Grounded intelligence · {result.searchedRecords} records checked</p>
              {result.anonymousRemaining !== null && (
                <p className="bs-label">· {result.anonymousRemaining} free {result.anonymousRemaining === 1 ? "question" : "questions"} left today</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copyBrief} className="bs-btn bs-btn-outline inline-flex items-center gap-2">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy brief"}
              </button>
              <button type="button" onClick={shareBrief} className="bs-btn bs-btn-outline inline-flex items-center gap-2">
                <Share2 className="h-3.5 w-3.5" />
                Share text
              </button>
              <ShareIntelligenceCardButton
                shareToken={result.shareToken}
                headline={result.answer.headline}
              />
            </div>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_1px_340px] mt-7">
            <div className="lg:pr-14 min-w-0">
              <p className="bs-label">The answer</p>
              <h2
                className="font-serif font-bold mt-3"
                style={{
                  fontSize: "clamp(38px, 5.5vw, 72px)",
                  lineHeight: 0.98,
                  letterSpacing: "-0.035em",
                }}
              >
                {result.answer.headline}
              </h2>
              <p
                className="font-serif mt-6 max-w-[64ch] text-[var(--color-fg-body)]"
                style={{ fontSize: "clamp(20px, 2.2vw, 27px)", lineHeight: 1.5 }}
              >
                {result.answer.answer}
              </p>

              {result.answer.signals.length > 0 && (
                <div className="grid sm:grid-cols-2 xl:grid-cols-4 rule-major mt-9">
                  {result.answer.signals.map((signal, index) => (
                    <div
                      key={`${signal.label}-${signal.value}`}
                      className={cn("py-5 sm:pr-5", index > 0 && "sm:rule-hair-l sm:pl-5")}
                    >
                      <p className="bs-label">{signal.label}</p>
                      <p
                        className="font-serif font-bold mt-2 tabular-nums"
                        style={{ fontSize: "clamp(28px, 3.2vw, 43px)", lineHeight: 1 }}
                      >
                        {signal.value}
                      </p>
                      <p className="mt-2 text-sm leading-5 text-[var(--color-fg-muted)]">
                        {signal.context}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid md:grid-cols-2 rule-major mt-9">
                <IntelligenceSection eyebrow="Why it matters" body={result.answer.whyItMatters} />
                <div className="md:rule-hair-l md:pl-8">
                  <IntelligenceSection eyebrow="The Desk take" body={result.answer.deskTake} />
                </div>
              </div>

              <div className="rule-major mt-8 pt-5 max-w-[70ch]">
                <p className="bs-label-accent">What would change our mind</p>
                <p className="font-serif mt-3 text-xl leading-8 text-[var(--color-fg-body)]">
                  {result.answer.whatWouldChangeOurMind}
                </p>
              </div>
            </div>

            <div className="hidden lg:block bg-[var(--color-border)]" />

            <aside className="lg:pl-9 mt-10 lg:mt-0">
              <div className="rule-major pt-4">
                <p className="bs-label">Confidence</p>
                <p
                  className="font-serif font-bold mt-2 capitalize"
                  style={{ fontSize: 34, lineHeight: 1 }}
                >
                  {result.answer.confidence}
                </p>
                <p className="mt-2 text-sm leading-5 text-[var(--color-fg-muted)]">
                  Confidence reflects the quality and agreement of the archive evidence, not certainty
                  about future outcomes.
                </p>
              </div>

              <div className="rule-major mt-8 pt-4">
                <p className="bs-label">Evidence used · {result.sources.length}</p>
                <div className="mt-3">
                  {result.sources.map((source) => (
                    <div key={source.ref} className="rule-hair py-4">
                      <div className="flex items-start gap-3">
                        <span className="bs-label-accent tabular-nums shrink-0">[{source.ref}]</span>
                        <div className="min-w-0">
                          <Link
                            href={source.href}
                            className="font-serif text-[18px] leading-6 bs-link block"
                          >
                            {source.title}
                          </Link>
                          <p className="bs-label mt-2" style={{ fontSize: 9 }}>
                            {source.date}
                            {source.publisher ? ` · ${source.publisher}` : ""}
                          </p>
                          {source.externalUrl && (
                            <a
                              href={source.externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-xs bs-link text-[var(--color-fg-muted)]"
                            >
                              Original source <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  mutation.reset();
                  setQuestion("");
                  window.setTimeout(() => inputRef.current?.focus(), 0);
                }}
                className="bs-btn bs-btn-outline w-full mt-7"
              >
                Ask another question
              </button>
            </aside>
          </div>
        </article>
      )}
    </div>
  );
}

function ProcessStep({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <div className="grid grid-cols-[34px_1fr] gap-3">
      <span className="bs-label-accent tabular-nums">{number}</span>
      <div>
        <p className="font-serif text-lg leading-5">{title}</p>
        <p className="mt-1.5 text-sm leading-5 text-[var(--color-fg-muted)]">{body}</p>
      </div>
    </div>
  );
}

function IntelligenceSection({ eyebrow, body }: { eyebrow: string; body: string }) {
  return (
    <section className="py-5 md:pr-8">
      <p className="bs-label-accent">{eyebrow}</p>
      <p className="font-serif mt-3 text-xl leading-8 text-[var(--color-fg-body)]">{body}</p>
    </section>
  );
}

function ThinkingState({ question }: { question: string }) {
  return (
    <div className="mt-10 rule-major pt-5 max-w-5xl" aria-live="polite">
      <div className="flex items-center justify-between gap-5">
        <div>
          <p className="bs-label-accent">Cross-referencing The Desk</p>
          <p className="font-serif text-2xl mt-2 text-[var(--color-fg-body)]">{question}</p>
        </div>
        <span className="bs-label animate-pulse">Analysing</span>
      </div>
      <div className="grid md:grid-cols-3 gap-5 mt-7">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-12 mt-6 w-5/6" />
      <Skeleton className="h-5 mt-3 w-full" />
      <Skeleton className="h-5 mt-2 w-11/12" />
    </div>
  );
}
