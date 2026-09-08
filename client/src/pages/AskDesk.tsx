import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearch } from "wouter";
import {
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  LoaderCircle,
  Search,
  Share2,
  ShieldCheck,
} from "lucide-react";
import { ShareIntelligenceCardButton } from "@/components/ask/ShareIntelligenceCardButton";
import { GUTTER_X } from "@/components/broadsheet/tokens";
import { trackEvent } from "@/lib/analytics";
import { readAskHistory, rememberAskQuestion } from "@/lib/askHistory";
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

export default function AskDeskPage() {
  const search = useSearch();
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const requestInFlight = useRef(false);
  const handledDeepLink = useRef<string | null>(null);
  const mutation = trpc.ask.answer.useMutation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    setHistory(readAskHistory());
    if (window.innerWidth >= 768) inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
  }, [question]);

  useEffect(() => {
    if (!mutation.isPending || window.innerWidth >= 768) return;
    inputRef.current?.blur();
    feedbackRef.current?.scrollIntoView({ block: "start" });
  }, [mutation.isPending]);

  useEffect(() => {
    const linkedQuestion = (new URLSearchParams(search).get("q") ?? "").trim().slice(0, 240);
    if (linkedQuestion.length < 3) {
      handledDeepLink.current = null;
      return;
    }
    if (
      linkedQuestion.length >= 3 &&
      linkedQuestion !== handledDeepLink.current &&
      !mutation.isPending && !requestInFlight.current
    ) {
      handledDeepLink.current = linkedQuestion;
      ask(linkedQuestion);
    }
  }, [search, mutation.isPending]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    ask(question);
  }

  function ask(rawQuestion: string) {
    const value = rawQuestion.trim().slice(0, 240);
    if (value.length < 3 || mutation.isPending || requestInFlight.current) return;
    // A ref closes the same-frame double-tap gap before React rerenders.
    requestInFlight.current = true;
    setQuestion(value);
    setCopied(false);
    setHistory(rememberAskQuestion(value, history));
    trackEvent("ask_query", "ask");
    mutation.mutate({ question: value }, {
      onSettled: () => { requestInFlight.current = false; },
    });
  }

  const result = mutation.data;
  const submittedQuestion = mutation.variables?.question ?? question.trim();
  const isQuotaError = mutation.error?.data?.code === "TOO_MANY_REQUESTS";
  const isTimeout = mutation.error?.data?.code === "TIMEOUT" ||
    mutation.error?.message.includes("This request took too long");

  function editQuestion(value: string) {
    mutation.reset();
    setQuestion(value);
    inputRef.current?.focus();
    inputRef.current?.scrollIntoView({ block: "center" });
  }

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
    const publicUrl = new URL(
      `/brief?token=${encodeURIComponent(result.shareToken)}`,
      window.location.origin
    ).toString();
    if (navigator.share) {
      try {
        await navigator.share({ title: result.answer.headline, text, url: publicUrl });
        trackEvent("ask_share", "ask");
        return;
      } catch (error) {
        // Cancelling the share sheet should not unexpectedly copy the brief.
        if (error instanceof Error && error.name === "AbortError") return;
        // Web Share is unavailable for this payload; try the clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n\n${publicUrl}`);
      trackEvent("ask_share", "ask");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard is unavailable on some non-secure local previews.
    }
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
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="What do you need to know about Australian property?"
            className="flex-1 min-w-0 resize-none overflow-y-auto bg-transparent border-0 outline-none font-serif"
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
            aria-label={mutation.isPending ? "Analysing your question" : "Ask The Desk"}
            className={cn(
              "h-12 w-12 lg:h-14 lg:w-14 shrink-0 flex items-center justify-center bs-btn-solid",
              mutation.isPending ? "disabled:opacity-70" : "disabled:opacity-30"
            )}
            style={{ borderRadius: 2 }}
          >
            {mutation.isPending ? (
              <LoaderCircle className="h-5 w-5 motion-safe:animate-spin" aria-hidden="true" />
            ) : (
              <ArrowUp className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            )}
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

      {mutation.isIdle && (
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

      <div ref={feedbackRef} className="scroll-mt-24">
      {mutation.isPending && <ThinkingState question={mutation.variables?.question ?? question.trim()} />}

      {mutation.isError && (
        <div className="rule-major mt-10 pt-6 max-w-3xl" role="alert">
          <p className="bs-label-accent">{isQuotaError ? "Ask allowance" : "Your question is saved below"}</p>
          <h2 className="font-serif text-3xl mt-2">
            {isQuotaError ? "You've reached an Ask limit." : isTimeout ? "That answer took too long." : "Something went wrong."}
          </h2>
          <p className="mt-3 text-[var(--color-fg-body)]">
            {isQuotaError ? mutation.error.message : "We couldn't complete this request. Try again, edit your question, or explore the archive."}
          </p>
          <p className="font-serif text-xl mt-4">{submittedQuestion}</p>
          <div className="flex flex-wrap gap-2 mt-5">
            {!isQuotaError && (
              <button type="button" onClick={() => ask(submittedQuestion)} className="bs-btn bs-btn-solid">
                Try again
              </button>
            )}
            <button type="button" onClick={() => editQuestion(submittedQuestion)} className="bs-btn bs-btn-outline">
              Edit question
            </button>
            <Link href={`/archive?q=${encodeURIComponent(submittedQuestion)}`} className="bs-btn bs-btn-outline">
              Search the archive
            </Link>
            {isQuotaError && !isAuthenticated && (
              <a href={getLoginUrl()} className="bs-btn bs-btn-solid">
                Sign in
              </a>
            )}
          </div>
        </div>
      )}

      {result?.status === "insufficient" && (
        <div className="rule-major mt-10 pt-6 max-w-3xl" role="status">
          <p className="bs-label-accent">More evidence needed</p>
          <h2
            className="font-serif font-bold mt-2"
            style={{ fontSize: "clamp(31px, 4vw, 50px)", lineHeight: 1.02 }}
          >
            We don't have enough verified information to answer this yet.
          </h2>
          <p className="font-serif mt-4 text-xl leading-8 text-[var(--color-fg-body)]">
            {result.message}
          </p>
          <p className="mt-4 text-sm leading-6 text-[var(--color-fg-muted)]">
            Try naming a suburb, lender or policy and the time period you mean.
            {!isAuthenticated && " This hasn't used a free question."}
          </p>
          <div className="flex flex-wrap gap-2 mt-6">
            <button type="button" onClick={() => editQuestion(result.question)} className="bs-btn bs-btn-solid">
              Refine question
            </button>
            <Link href={`/archive?q=${encodeURIComponent(result.question)}`} className="bs-btn bs-btn-outline">
              Search the archive
            </Link>
          </div>
          {result.sources.length > 0 && (
            <div className="rule-hair mt-7 pt-4">
              <p className="bs-label">Explore the records we found</p>
              <p className="mt-2 text-sm text-[var(--color-fg-muted)]">These records did not provide enough evidence for a verified answer.</p>
              {result.sources.map((source) => (
                <Link key={source.ref} href={source.href} className="block font-serif text-xl bs-link rule-hair mt-3 pt-3">
                  {source.title}
                </Link>
              ))}
            </div>
          )}
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
  const [isTakingLonger, setIsTakingLonger] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsTakingLonger(true), 15000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section className="mt-10 rule-major pt-5 max-w-5xl" aria-label="Answer in progress">
      <p className="bs-label-accent">Cross-referencing The Desk</p>
      <p className="font-serif text-2xl mt-2 text-[var(--color-fg-body)]">{question}</p>

      <div className="mt-6 border border-[var(--color-border)] border-l-2 border-l-[var(--color-accent-text)] bg-[var(--color-bg-elevated)] p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-[var(--color-accent-text)] text-[var(--color-accent-text)]" aria-hidden="true">
            <LoaderCircle className="h-7 w-7 motion-safe:animate-spin" strokeWidth={1.5} />
          </div>
          <div className="min-w-0" role="status" aria-live="polite" aria-atomic="true">
            <p className="font-serif text-xl sm:text-2xl leading-tight">
              {isTakingLonger ? "Still working on your answer" : "Analysing your question"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-fg-muted)]">
              {isTakingLonger
                ? "This is taking a little longer. Your question is still being processed — no need to submit it again."
                : "The Desk is checking its reporting to build a sourced intelligence brief."}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3 motion-safe:animate-pulse" aria-hidden="true">
          <div className="h-3 w-3/4 bg-[var(--color-fg-muted)] opacity-20" />
          <div className="h-2 w-full bg-[var(--color-fg-muted)] opacity-15" />
          <div className="h-2 w-5/6 bg-[var(--color-fg-muted)] opacity-15" />
        </div>
        <p className="mt-5 text-xs leading-5 text-[var(--color-fg-muted)]">
          Your brief will appear here automatically.
        </p>
      </div>
    </section>
  );
}
