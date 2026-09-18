import { GUIDE_EXAMPLES } from "./guideExamples";
import type { ReactNode } from "react";
import {
  GUIDE_REVIEWED,
  PROPERTY_GUIDES,
  guideArchiveHref,
  type PropertyGuide,
} from "./propertyGuides";

export function PropertyGuideRead({
  guide,
  children,
}: {
  guide?: PropertyGuide;
  children?: ReactNode;
}) {
  return (
    <article className="max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
      <nav aria-label="Breadcrumb" className="bs-label mb-8 flex flex-wrap gap-3">
        <a className="bs-link" href="/">
          The Desk
        </a>
        <span aria-hidden="true">/</span>
        {guide ? (
          <a className="bs-link" href="/guides">
            Property explained
          </a>
        ) : (
          <span>Property explained</span>
        )}
        {guide && (
          <>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{guide.topic}</span>
          </>
        )}
      </nav>
      <header className="max-w-3xl">
        <p className="bs-label-accent">
          {guide ? `${guide.topic} · The essentials` : "No assumed knowledge"}
        </p>
        <h1 className="font-serif font-bold mt-4 text-4xl sm:text-6xl tracking-tight leading-[1.06]">
          {guide?.title ?? "Understand the headline. Then follow the evidence."}
        </h1>
        <p className="mt-6 text-lg sm:text-xl leading-relaxed text-[var(--color-fg-muted)]">
          {guide?.intro ??
            "Short, sourced guides to the measures behind Australian property news. Start with a question, understand the distinctions, then read the latest reporting."}
        </p>
      </header>
      {guide ? (
        <>
          <p className="bs-label mt-5">
            The Desk explainer · AI-assisted source check{" "}
            <time dateTime={GUIDE_REVIEWED}>18 September 2026</time>
          </p>
          <section
            aria-label="The key distinctions"
            className="grid md:grid-cols-3 gap-8 mt-10 rule-major pt-7"
          >
            {guide.distinctions.map((item, i) => (
              <div key={item.title}>
                <p className="bs-label-accent">0{i + 1}</p>
                <h2 className="font-serif text-2xl font-bold mt-3">{item.title}</h2>
                <p className="mt-3 leading-relaxed text-[var(--color-fg-muted)]">{item.text}</p>
              </div>
            ))}
          </section>
          <p className="mt-6 text-sm leading-relaxed">
            Source and method:{" "}
            <a
              className="bs-link underline"
              href={guide.source.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {guide.source.title} ↗
            </a>
          </p>
          <section className="mt-9 rule-hair pt-6 max-w-3xl">
            <h2 className="font-serif text-2xl font-bold">
              The question to take back to the story
            </h2>
            <p className="mt-3 text-lg leading-relaxed">{guide.check}</p>
            <p className="mt-4 text-sm text-[var(--color-fg-muted)]">
              This explains how to read a measure. It is not a current market reading or a forecast.
            </p>
          </section>
          {GUIDE_EXAMPLES[guide.slug] && (
            <section className="mt-8 rule-hair pt-6 max-w-3xl">
              <p className="bs-label-accent">Worked example · hypothetical</p>
              <h2 className="font-serif text-2xl mt-3">{GUIDE_EXAMPLES[guide.slug]!.title}</h2>
              <p className="mt-3 leading-7">{GUIDE_EXAMPLES[guide.slug]!.text}</p>
            </section>
          )}
          {children}
          <nav
            aria-label="Follow the evidence"
            className="flex flex-wrap gap-4 mt-9 rule-hair pt-6"
          >
            <a className="bs-btn bs-btn-solid" href={guideArchiveHref(guide)}>
              Latest {guide.topic.toLowerCase()} reporting →
            </a>
            <a className="bs-btn bs-btn-outline" href="/signals">
              Check the current data →
            </a>
            <a className="bs-btn bs-btn-outline" href="/guides">
              All guides →
            </a>
          </nav>
        </>
      ) : (
        <section
          aria-label="Choose a property question"
          className="grid md:grid-cols-2 gap-x-10 mt-10"
        >
          {PROPERTY_GUIDES.map((item, i) => (
            <a
              key={item.slug}
              href={`/guides/${item.slug}`}
              className="bs-link block rule-hair py-7 min-w-0"
            >
              <p className="bs-label-accent">
                0{i + 1} · {item.topic}
                {item.slug === "interest-rates" ? " · Try the repayment tool" : ""}
              </p>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold mt-3 leading-tight">
                {item.title} <span aria-hidden="true">↗</span>
              </h2>
              <p className="mt-3 leading-relaxed text-[var(--color-fg-muted)]">{item.intro}</p>
            </a>
          ))}
        </section>
      )}
    </article>
  );
}
