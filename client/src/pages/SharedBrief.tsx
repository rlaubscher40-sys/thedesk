import { ArrowRight, ShieldCheck } from "lucide-react";
import { Link, useSearch } from "wouter";
import { GUTTER_X } from "@/components/broadsheet/tokens";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { trpc } from "@/lib/trpc";

export default function SharedBriefPage() {
  const search = useSearch();
  const token = new URLSearchParams(search).get("t") ?? "";
  const brief = trpc.ask.shared.useQuery(
    { token },
    { enabled: token.length >= 20, retry: false, staleTime: 30 * 60_000 }
  );

  if (token.length < 20) return <InvalidBrief />;
  if (brief.isLoading) return <BriefSkeleton />;
  if (brief.isError || !brief.data) return <InvalidBrief />;

  const data = brief.data;

  return (
    <div className={cn(GUTTER_X, "pt-10 pb-16")}>
      <header className="rule-major pt-4 max-w-[1180px]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 text-[var(--color-accent-text)]" strokeWidth={1.7} />
            <p className="bs-label-accent">The Desk · Shared intelligence</p>
          </div>
          <p className="bs-label">
            {data.sourceCount} source{data.sourceCount === 1 ? "" : "s"} · {data.confidence} confidence
          </p>
        </div>

        <p className="bs-label mt-8">Question</p>
        <p
          className="font-serif mt-2 max-w-[54ch] text-[var(--color-fg-muted)]"
          style={{ fontSize: "clamp(18px, 2vw, 24px)", lineHeight: 1.4 }}
        >
          {data.question}
        </p>

        <h1
          className="font-serif font-bold mt-5 max-w-[22ch]"
          style={{
            fontSize: "clamp(42px, 6.4vw, 82px)",
            lineHeight: 0.96,
            letterSpacing: "-0.04em",
            textWrap: "pretty",
          }}
        >
          {data.headline}
        </h1>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_1px_340px] mt-9">
        <main className="lg:pr-14 min-w-0">
          <section>
            <p className="bs-label">The answer</p>
            <p
              className="font-serif mt-3 max-w-[62ch] text-[var(--color-fg-body)]"
              style={{ fontSize: "clamp(20px, 2.3vw, 28px)", lineHeight: 1.52 }}
            >
              {data.answer}
            </p>
          </section>

          <section className="rule-major mt-9 pt-6 max-w-[68ch]">
            <p className="bs-label-accent">The Desk take</p>
            <p className="font-serif mt-3 text-xl leading-8 text-[var(--color-fg-body)]">
              {data.deskTake}
            </p>
          </section>

          {data.signal && (
            <section className="rule-major mt-9 pt-6">
              <p className="bs-label">Signal</p>
              <div className="grid sm:grid-cols-[minmax(0,220px)_1fr] gap-5 sm:gap-8 mt-3 items-start">
                <div>
                  <p className="bs-label-accent">{data.signal.label}</p>
                  <p
                    className="font-serif font-bold tabular-nums mt-2"
                    style={{ fontSize: "clamp(40px, 5vw, 64px)", lineHeight: 0.95 }}
                  >
                    {data.signal.value}
                  </p>
                </div>
                <p className="font-serif text-xl leading-8 text-[var(--color-fg-body)]">
                  {data.signal.context}
                </p>
              </div>
            </section>
          )}
        </main>

        <div className="hidden lg:block bg-[var(--color-border)]" aria-hidden="true" />

        <aside className="lg:pl-9 mt-10 lg:mt-0">
          <div className="rule-major pt-4">
            <p className="bs-label">What this is</p>
            <p className="mt-3 text-[15px] leading-6 text-[var(--color-fg-body)]">
              A signed snapshot of an Ask The Desk answer. It was generated from evidence already
              inside The Desk, then frozen for sharing. The link expires automatically.
            </p>
          </div>

          <div className="rule-major mt-8 pt-5">
            <p className="bs-label-accent">Go deeper</p>
            <p className="font-serif mt-2 text-2xl leading-8">
              Ask the archive your own property question.
            </p>
            <Link href="/ask" className="bs-btn bs-btn-solid mt-5 inline-flex items-center gap-2">
              Ask The Desk <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="rule-hair mt-8 pt-5">
            <p className="bs-label">Grounding note</p>
            <p className="mt-2 text-sm leading-5 text-[var(--color-fg-muted)]">
              Confidence describes the supplied evidence, not certainty about future market outcomes.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function InvalidBrief() {
  return (
    <div className={cn(GUTTER_X, "py-16")}>
      <div className="rule-major pt-6 max-w-3xl">
        <p className="bs-label-accent">Shared intelligence</p>
        <h1 className="font-serif font-bold mt-3" style={{ fontSize: 46, lineHeight: 1 }}>
          This brief is no longer available.
        </h1>
        <p className="font-serif mt-4 text-xl leading-8 text-[var(--color-fg-body)]">
          The link is invalid or has expired. Ask The Desk to build a fresh sourced view.
        </p>
        <Link href="/ask" className="bs-btn bs-btn-solid mt-6 inline-flex items-center gap-2">
          Ask The Desk <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function BriefSkeleton() {
  return (
    <div className={cn(GUTTER_X, "py-12")} aria-busy="true">
      <div className="rule-major pt-5 max-w-5xl space-y-4">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-6 w-3/5" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-4/5" />
      </div>
      <div className="grid lg:grid-cols-3 gap-6 mt-10">
        <Skeleton className="h-40 lg:col-span-2" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}
