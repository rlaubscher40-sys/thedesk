/**
 * Weekly edition reader — the flagship long read, in broadsheet dress.
 *
 * Order: folio, cover band, slug row, week-range title, tagline, then
 * Ruben's Take beside In brief, the metrics strip, the contents row, the
 * lead topic (two-column prose with the drop cap), the topic deck, and
 * More signals beside Dates to watch.
 *
 * The section components this used to compose (EditionHero, LeadStory,
 * TopicCard, SignalsBriefs) were built around the panel vocabulary the
 * redesign drops, so the layout is expressed here directly and they are
 * no longer used by this page. Behaviour that already existed — Listen,
 * Share edition, the look-back, the collapsed deep dives behind "Read
 * deep dive", the admin panel, persona-ordered talking points — is
 * carried over unchanged.
 */
import { useState } from "react";
import type { Edition } from "@shared/types";
import type { EditionTopic, KeyMetrics } from "@shared/schemas";
import { signalCategory, signalText } from "@shared/schemas";
import { SectionErrorBoundary } from "../ErrorBoundary";
import { ScrollProgress } from "../ScrollProgress";
import { SubscribeBand } from "../broadsheet/SubscribeBand";
import { GUTTER_X } from "../broadsheet/tokens";
import { useCategoryColour } from "@/lib/category";
import { cn } from "@/lib/cn";
import { dedash } from "@/lib/dedash";
import { resolveMetricTrend } from "@/lib/metrics";
import { EditionAdminPanel } from "./EditionAdminPanel";
import { EditorsLetter } from "./EditorsLetter";
import { ListenButton } from "./ListenButton";
import { LookbackSection } from "./LookbackSection";
import { ShareEditionButton } from "./ShareEditionButton";
import { TalkingPointsBlock } from "./TalkingPointsBlock";

/**
 * Flatten an edition into a plain-text script the browser's SpeechSynthesis
 * can read end-to-end. Keeps the natural reading order: take, letter, lead,
 * each topic in turn. Signals + dates are skipped, they're scannable, not
 * listenable.
 */
function buildAudioScript(edition: Edition): string {
  const parts: string[] = [];
  parts.push(`Edition ${edition.editionNumber}. ${edition.weekRange}.`);
  if (edition.rubensTake) parts.push(`Ruben's take. ${edition.rubensTake}`);
  if (edition.fullText) parts.push(edition.fullText);
  for (const topic of edition.topics ?? []) {
    parts.push(`${topic.category}. ${topic.title}.`);
    if (topic.summary) parts.push(topic.summary);
    if (topic.body) parts.push(topic.body);
    if (topic.keyTakeaway) parts.push(`Key takeaway. ${topic.keyTakeaway}`);
  }
  return parts.join("\n\n");
}

export function EditionReader({
  edition,
  priorMetrics,
  priorMarketStress,
}: {
  edition: Edition;
  /** Prior edition's keyMetrics, drives the trend arrows on the strip. */
  priorMetrics?: KeyMetrics | null;
  /** Prior edition's marketStress, drives the rising/easing badge. */
  priorMarketStress?: string | null;
}) {
  const topics = edition.topics ?? [];
  const [lead, ...rest] = topics;
  const audioScript = buildAudioScript(edition);
  const signals = edition.signals ?? [];

  return (
    <article>
      <ScrollProgress />

      <Folio edition={edition} priorMarketStress={priorMarketStress ?? null} />

      {/* Cover band. A 16:5 cinematic strip carrying the edition's own hero
          image when synthesis produced one, otherwise a quiet tinted plate —
          no stock-photography stand-in. */}
      <div className={cn(GUTTER_X, "mt-6")}>
        <div
          className="w-full overflow-hidden"
          style={{
            height: 300,
            background: edition.heroImageUrl ? undefined : "var(--grad-hero-placeholder)",
          }}
        >
          {edition.heroImageUrl && (
            <img
              src={edition.heroImageUrl}
              alt=""
              className="h-full w-full object-cover object-center"
              loading="eager"
              decoding="async"
            />
          )}
        </div>

        <div className="flex items-baseline justify-between gap-5 flex-wrap mt-6">
          <div className="flex items-baseline gap-4">
            <p className="bs-label-accent" style={{ fontSize: 11, letterSpacing: "0.24em" }}>
              Edition No. {edition.editionNumber}
            </p>
            <span
              className="block h-px w-8"
              style={{ background: "var(--color-border-strong)" }}
              aria-hidden="true"
            />
            {edition.readingTime && <p className="bs-label">{edition.readingTime} read</p>}
          </div>
          <div className="flex gap-2">
            <ListenButton text={audioScript} />
            <ShareEditionButton edition={edition} />
          </div>
        </div>

        <h1
          className="font-serif font-bold mt-4 max-w-[24ch]"
          style={{
            fontSize: "clamp(36px, 5.4vw, 70px)",
            lineHeight: 0.96,
            letterSpacing: "-0.03em",
            textWrap: "pretty",
          }}
        >
          {edition.weekRange}
        </h1>
        <p
          className="font-serif italic mt-4 max-w-[60ch]"
          style={{ fontSize: 21, lineHeight: 1.4, color: "var(--color-fg-muted)" }}
        >
          Weekly intelligence for property partnerships.
        </p>
      </div>

      {(edition.rubensTake || signals.length > 0) && (
        <SectionErrorBoundary section="Ruben's take">
          <div
            className={cn(
              GUTTER_X,
              "rule-major mt-9 pt-7 grid gap-10 lg:gap-13 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"
            )}
          >
            {edition.rubensTake && (
              <div
                className="pl-6 lg:pl-7"
                style={{ borderLeft: "4px solid var(--color-accent-text)" }}
              >
                <p className="bs-label-accent" style={{ letterSpacing: "0.24em" }}>
                  Ruben&apos;s take
                </p>
                <p
                  className="font-serif mt-3.5"
                  style={{
                    fontSize: "clamp(22px, 2.5vw, 31px)",
                    lineHeight: 1.24,
                    letterSpacing: "-0.03em",
                    textWrap: "pretty",
                  }}
                >
                  &ldquo;{dedash(edition.rubensTake)}&rdquo;
                </p>
                <div className="rule-hair mt-6 pt-5 flex items-center gap-3.5">
                  <img
                    src="/ruben.jpg"
                    alt=""
                    width={42}
                    height={42}
                    loading="lazy"
                    decoding="async"
                    className="h-[42px] w-[42px] rounded-full object-cover shrink-0"
                  />
                  <div>
                    <p style={{ fontSize: 14.5 }}>
                      <span className="font-semibold">Ruben Laubscher</span>
                    </p>
                    <p className="bs-label mt-1" style={{ letterSpacing: "0.14em" }}>
                      Head of Partnerships, InvestorKit
                    </p>
                  </div>
                </div>
              </div>
            )}

            {signals.length > 0 && (
              <div
                className="p-6"
                style={{
                  border: "1px solid var(--color-border)",
                  background: "var(--color-bg-elevated)",
                }}
              >
                <p className="bs-label-accent" style={{ letterSpacing: "0.22em" }}>
                  In brief
                </p>
                <ol className="list-none m-0 p-0 mt-4 flex flex-col gap-3">
                  {signals.slice(0, 6).map((s, i) => (
                    <li key={i} className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 items-baseline">
                      <span
                        className="font-mono tabular-nums"
                        style={{ fontSize: 11, color: "var(--color-accent-text)" }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span style={{ fontSize: 14, lineHeight: 1.45 }}>
                        {dedash(signalText(s))}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </SectionErrorBoundary>
      )}

      <MetricsStrip metrics={edition.keyMetrics ?? null} prior={priorMetrics ?? null} />

      {/* Accountability look-back: how last week's calls played out. */}
      {edition.lookback && (
        <SectionErrorBoundary section="Last week in review">
          <div className={cn(GUTTER_X, "mt-9")}>
            <LookbackSection lookback={edition.lookback} />
          </div>
        </SectionErrorBoundary>
      )}

      {topics.length >= 3 && <Contents topics={topics} />}

      {lead && (
        <SectionErrorBoundary section="Lead story">
          <LeadTopic topic={lead} />
        </SectionErrorBoundary>
      )}

      {edition.fullText && (
        <SectionErrorBoundary section="Editor's letter">
          <EditorsLetter fullText={edition.fullText} />
        </SectionErrorBoundary>
      )}

      {rest.length > 0 && (
        <SectionErrorBoundary section="Topics">
          <TopicDeck topics={rest} />
        </SectionErrorBoundary>
      )}

      <MoreSignalsAndDates signals={signals} dates={edition.datesToWatch ?? []} />

      <SectionErrorBoundary section="Subscribe">
        <SubscribeBand
          source="edition-foot"
          kicker="Next edition · Sunday"
          headline="Get the edition the morning it publishes."
          blurb="One weekly long read, five daily briefs, and the lines already written for your next client conversation."
          showHeadshot={false}
        />
      </SectionErrorBoundary>

      <SectionErrorBoundary section="Admin panel">
        <div className={cn(GUTTER_X, "mt-10")}>
          <EditionAdminPanel edition={edition} />
        </div>
      </SectionErrorBoundary>
    </article>
  );
}

/** The folio: strong rule, dateline, market-stress badge, small wordmark. */
function Folio({
  edition,
  priorMarketStress,
}: {
  edition: Edition;
  priorMarketStress: string | null;
}) {
  const stress = edition.marketStress;
  const RANK: Record<string, number> = { low: 0, moderate: 1, elevated: 2, high: 3 };
  const now = stress ? RANK[stress.toLowerCase()] : undefined;
  const before = priorMarketStress ? RANK[priorMarketStress.toLowerCase()] : undefined;
  const direction =
    now == null || before == null || now === before
      ? null
      : now > before
        ? { label: "rising", colour: "var(--sentiment-bad)", glyph: "▲" }
        : { label: "easing", colour: "var(--sentiment-good)", glyph: "▼" };

  return (
    <div className={GUTTER_X}>
      <div className="h-px" style={{ background: "var(--color-border-strong)" }} />
      <div className="flex items-center justify-between gap-4 flex-wrap py-2.5">
        <span className="bs-label" style={{ letterSpacing: "0.24em" }}>
          Edition No. {edition.editionNumber} · Week of {edition.weekOf} · Sydney
        </span>
        <div className="flex items-center gap-5">
          {stress && (
            <span
              className="bs-label inline-flex items-center gap-2"
              style={{ color: "var(--color-accent-text)" }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "currentColor" }}
                aria-hidden="true"
              />
              {stress} stress
              {direction && (
                <span style={{ color: direction.colour }}>
                  {direction.glyph} {direction.label}
                </span>
              )}
            </span>
          )}
          <span
            className="font-serif font-bold"
            style={{ fontSize: 15, letterSpacing: "-0.02em" }}
          >
            The Desk
          </span>
        </div>
      </div>
      <div className="h-px" style={{ background: "var(--color-border-strong)" }} />
      <div className="h-px mt-px" style={{ background: "var(--color-border)" }} />
    </div>
  );
}

/** Six mono values between two band rules. */
function MetricsStrip({
  metrics,
  prior,
}: {
  metrics: KeyMetrics | null;
  prior: KeyMetrics | null;
}) {
  const entries = Object.entries(metrics ?? {}).slice(0, 6);
  if (entries.length === 0) return null;

  return (
    <div
      className={cn(
        GUTTER_X,
        "rule-band rule-band-b mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
      )}
    >
      {entries.map(([label, value], i) => {
        const priorValue = prior?.[label];
        const { hasDelta, delta, trend, sentiment } = resolveMetricTrend(
          label,
          value,
          priorValue ?? null
        );
        return (
          <div
            key={label}
            className={cn(
              "py-4 min-w-0",
              i > 0 && "lg:rule-hair-l lg:pl-4",
              i < entries.length - 1 && "lg:pr-4"
            )}
          >
            <p
              className="bs-label truncate"
              style={{ fontSize: 9.5, letterSpacing: "0.18em" }}
              title={label}
            >
              {label}
            </p>
            <p className="font-mono tabular-nums mt-2" style={{ fontSize: 22 }}>
              {value}
              {hasDelta && trend !== "flat" && (
                <span style={{ fontSize: 11, color: `var(--sentiment-${sentiment})` }}>
                  {" "}
                  {trend === "up" ? "▲" : "▼"}
                  {Math.abs(delta).toFixed(2)}
                </span>
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** Numbered contents columns; anchors resolve to the scroll-mt'd topics. */
function Contents({ topics }: { topics: EditionTopic[] }) {
  return (
    <nav className={cn(GUTTER_X, "mt-8")} aria-label="In this edition">
      <p className="bs-label mb-4" style={{ letterSpacing: "0.24em" }}>
        In this edition
      </p>
      <div className="rule-hair grid sm:grid-cols-2 lg:grid-cols-4">
        {topics.map((t, i) => (
          <a
            key={`toc-${i}`}
            href={`#topic-${i}`}
            className={cn(
              "bs-row block py-4 min-w-0",
              i > 0 && "lg:rule-hair-l lg:pl-5",
              i < topics.length - 1 && "lg:pr-5"
            )}
          >
            <span
              className="font-mono tabular-nums"
              style={{
                fontSize: 10,
                color: i === 0 ? "var(--color-accent-text)" : "var(--color-fg-muted)",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <p
              className="font-serif mt-1.5"
              style={{ fontSize: 17, lineHeight: 1.26, letterSpacing: "-0.02em" }}
            >
              {t.title || t.category}
            </p>
          </a>
        ))}
      </div>
    </nav>
  );
}

/** The lead topic: the edition's long read. */
function LeadTopic({ topic }: { topic: EditionTopic }) {
  const colourFor = useCategoryColour();
  const colour = colourFor(topic.category);

  return (
    <section id="topic-0" className={cn(GUTTER_X, "rule-major scroll-mt-24 mt-10 pt-6")}>
      <div className="flex items-center gap-3.5">
        <span className="block h-px w-8" style={{ background: colour }} aria-hidden="true" />
        <p className="bs-label-accent" style={{ fontSize: 11, letterSpacing: "0.24em" }}>
          Lead story <span className="text-[var(--color-fg-muted)] mx-1.5">·</span>
          <span style={{ color: colour }}>{topic.category}</span>
        </p>
      </div>

      <h2
        className="font-serif font-bold mt-4 max-w-[24ch]"
        style={{
          fontSize: "clamp(32px, 4.3vw, 56px)",
          lineHeight: 0.99,
          letterSpacing: "-0.03em",
          textWrap: "pretty",
        }}
      >
        {topic.title}
      </h2>

      {topic.summary && (
        <p
          className="font-serif italic mt-4 max-w-[64ch]"
          style={{ fontSize: 23, lineHeight: 1.45, color: "var(--color-fg-muted)" }}
        >
          {dedash(topic.summary)}
        </p>
      )}

      {topic.whyItMatters && (
        <div
          className="mt-6 max-w-[68ch] px-6 py-4"
          style={{
            borderLeft: `3px solid ${colour}`,
            background: `color-mix(in oklab, ${colour} 6%, transparent)`,
          }}
        >
          <p
            className="font-mono uppercase"
            style={{ fontSize: 10, letterSpacing: "0.22em", color: colour }}
          >
            Why this matters
          </p>
          <p className="mt-2" style={{ fontSize: 16, lineHeight: 1.6, color: "var(--color-fg-body)" }}>
            {dedash(topic.whyItMatters)}
          </p>
        </div>
      )}

      {topic.body && (
        <div className="bs-columns has-dropcap mt-7">
          {topic.body
            .split(/\n{2,}/)
            .map((para) => para.trim())
            .filter(Boolean)
            .map((para, i) => (
              <p
                key={i}
                style={{
                  fontSize: 16.5,
                  lineHeight: 1.75,
                  color: "var(--color-fg-body)",
                  margin: "0 0 18px 0",
                }}
              >
                {dedash(para)}
              </p>
            ))}
        </div>
      )}

      {topic.keyTakeaway && (
        <div className="rule-hair mt-6 pt-5 max-w-[68ch]">
          <p className="bs-label-accent" style={{ letterSpacing: "0.24em" }}>
            Key takeaway
          </p>
          <p className="font-serif mt-2.5" style={{ fontSize: 22, lineHeight: 1.4 }}>
            {dedash(topic.keyTakeaway)}
          </p>
        </div>
      )}

      {(topic.talkingPoints || (topic.whatToWatch?.length ?? 0) > 0) && (
        <div className="rule-hair mt-7 pt-5 grid gap-10 lg:gap-13 lg:grid-cols-2">
          {topic.talkingPoints && (
            <div>
              <p className="bs-label mb-3.5" style={{ letterSpacing: "0.24em" }}>
                Talking points
              </p>
              <TalkingPointsBlock points={topic.talkingPoints} />
            </div>
          )}
          {topic.whatToWatch && topic.whatToWatch.length > 0 && (
            <div>
              <p className="bs-label mb-3.5" style={{ letterSpacing: "0.24em" }}>
                What to watch
              </p>
              <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
                {topic.whatToWatch.map((w, i) => (
                  <li
                    key={i}
                    className="flex gap-3"
                    style={{ fontSize: 15.5, lineHeight: 1.55, color: "var(--color-fg-body)" }}
                  >
                    <span style={{ color: "var(--color-accent-text)" }} aria-hidden="true">
                      ▸
                    </span>
                    <span>{dedash(w)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** Three hairline-divided columns; the deep dive stays behind the link. */
function TopicDeck({ topics }: { topics: EditionTopic[] }) {
  return (
    <section className={cn(GUTTER_X, "rule-major mt-11 pt-5")}>
      <p className="bs-label mb-6" style={{ letterSpacing: "0.24em" }}>
        Topic deck
      </p>
      <div className="grid gap-y-10 md:grid-cols-2 lg:grid-cols-3">
        {topics.map((topic, idx) => (
          <DeckColumn
            key={`${topic.title || "topic"}-${idx}`}
            topic={topic}
            index={idx + 1}
            className={cn(
              idx % 3 !== 0 && "lg:rule-hair-l lg:pl-8",
              idx % 3 !== 2 && "lg:pr-8"
            )}
          />
        ))}
      </div>
    </section>
  );
}

function DeckColumn({
  topic,
  index,
  className,
}: {
  topic: EditionTopic;
  index: number;
  className?: string;
}) {
  const colourFor = useCategoryColour();
  const [open, setOpen] = useState(false);

  return (
    <article id={`topic-${index}`} className={cn("scroll-mt-24 min-w-0", className)}>
      <p
        className="font-mono uppercase"
        style={{ fontSize: 10, letterSpacing: "0.18em", color: colourFor(topic.category) }}
      >
        {String(index + 1).padStart(2, "0")} · {topic.category}
      </p>
      <h3
        className="font-serif font-bold mt-2.5"
        style={{
          fontSize: "clamp(22px, 2.2vw, 28px)",
          lineHeight: 1.1,
          letterSpacing: "-0.025em",
          textWrap: "pretty",
        }}
      >
        {topic.title}
      </h3>
      {topic.summary && (
        <p
          className="font-serif italic mt-3"
          style={{ fontSize: 17, lineHeight: 1.5, color: "var(--color-fg-muted)" }}
        >
          {dedash(topic.summary)}
        </p>
      )}
      {topic.whyItMatters && (
        <p className="mt-3.5" style={{ fontSize: 16, lineHeight: 1.62, color: "var(--color-fg-body)" }}>
          {dedash(topic.whyItMatters)}
        </p>
      )}

      {topic.body && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="bs-label bs-link mt-3.5 inline-block"
            style={{ color: "var(--color-accent-text)" }}
          >
            {open ? "Close deep dive ↑" : "Read deep dive →"}
          </button>
          {open && (
            <div className="rule-hair mt-4 pt-4">
              {topic.body
                .split(/\n{2,}/)
                .map((p) => p.trim())
                .filter(Boolean)
                .map((para, i) => (
                  <p
                    key={i}
                    style={{
                      fontSize: 15.5,
                      lineHeight: 1.7,
                      color: "var(--color-fg-body)",
                      margin: "0 0 14px 0",
                    }}
                  >
                    {dedash(para)}
                  </p>
                ))}
              {topic.keyTakeaway && (
                <p className="font-serif mt-1" style={{ fontSize: 18, lineHeight: 1.4 }}>
                  {dedash(topic.keyTakeaway)}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </article>
  );
}

/** More signals grouped by beat, beside the forward calendar. */
function MoreSignalsAndDates({
  signals,
  dates,
}: {
  signals: Edition["signals"];
  dates: NonNullable<Edition["datesToWatch"]>;
}) {
  const colourFor = useCategoryColour();
  // The first six signals already ran in the In-brief plate; this section
  // is what's left, grouped by the beat each signal carries.
  const remaining = (signals ?? []).slice(6);
  const groups = new Map<string, string[]>();
  for (const s of remaining) {
    const beat = (signalCategory(s) ?? "OTHER").toUpperCase();
    const arr = groups.get(beat) ?? [];
    arr.push(signalText(s));
    groups.set(beat, arr);
  }

  if (groups.size === 0 && dates.length === 0) return null;

  return (
    <div
      className={cn(
        GUTTER_X,
        "rule-major mt-11 pt-5 grid gap-10 lg:gap-13 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"
      )}
    >
      {groups.size > 0 && (
        <div>
          <p className="bs-label mb-5" style={{ letterSpacing: "0.24em" }}>
            More signals
          </p>
          <div className="grid gap-8 sm:grid-cols-2">
            {[...groups.entries()].map(([beat, lines]) => (
              <div key={beat}>
                <p
                  className="font-mono uppercase mb-3"
                  style={{ fontSize: 10, letterSpacing: "0.2em", color: colourFor(beat) }}
                >
                  {beat}
                </p>
                <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
                  {lines.map((line, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span style={{ color: "var(--color-accent-text)" }} aria-hidden="true">
                        ▸
                      </span>
                      <span className="font-serif" style={{ fontSize: 17, lineHeight: 1.4 }}>
                        {dedash(line)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {dates.length > 0 && (
        <div>
          <p className="bs-label mb-5" style={{ letterSpacing: "0.24em" }}>
            Dates to watch
          </p>
          <div>
            {dates.map((d, i) => (
              <div
                key={`${d.label}-${i}`}
                className={cn(
                  "rule-hair grid grid-cols-[78px_minmax(0,1fr)] gap-4 py-3",
                  i === dates.length - 1 && "rule-hair-b"
                )}
              >
                <span
                  className="font-mono uppercase"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.16em",
                    color: "var(--color-accent-text)",
                  }}
                >
                  {d.label}
                </span>
                <p style={{ fontSize: 15, lineHeight: 1.5, color: "var(--color-fg-muted)" }}>
                  {dedash(d.description)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
