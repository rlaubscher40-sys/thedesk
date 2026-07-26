/**
 * About — the credibility page a prospect reads second.
 *
 * The type is the hero: an 88px statement headline and a 25px standfirst,
 * no hero image. Under them a facts strip of four hairline-divided cells
 * (the trust content the old page buried in a sidebar <dl>), then a
 * 1.6fr / 1px / 1fr body with the pull quote and three rule-headed
 * sections on the left, and the curator plate, production table and desk
 * image on the right.
 *
 * The "How we use AI" copy is carried over verbatim, and still links to
 * the editorial standards page.
 */
import { useState } from "react";
import { Link } from "wouter";
import { Instagram, Linkedin } from "@/components/icons/BrandIcons";
import { SubscribeBand } from "@/components/broadsheet/SubscribeBand";
import { GUTTER_X } from "@/components/broadsheet/tokens";
import { cn } from "@/lib/cn";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { trpc } from "@/lib/trpc";

const SUBSTACK_URL = "https://rubenlaubscher.substack.com/";
const LINKEDIN_URL = "https://www.linkedin.com/in/ruben-laubscher/";
const INSTAGRAM_URL = "https://www.instagram.com/thedesk.au/";

const HOW_TO_USE = [
  "Open Today first thing. Copy a Say This line into a partner conversation.",
  "Save what you can't read now. The queue keeps it, and syncs when you sign in.",
  "Open the edition on Sunday for the deep dive, the signals and the dates to watch.",
  "Press / to search from anywhere. ⌘K opens the command palette.",
];

export default function About() {
  useDocumentTitle("About");
  // How many editions have actually shipped. The latest edition's *number*
  // is not that count — editions can be numbered from any starting point —
  // so this reads the list length rather than the newest number.
  const editionsQuery = trpc.editions.list.useQuery();
  const editionCount = editionsQuery.data?.length ?? 0;

  return (
    <div>
      {/* Statement */}
      <section className={cn(GUTTER_X, "pt-10")}>
        <p className="bs-label-accent" style={{ letterSpacing: "0.26em" }}>
          About · The Desk
        </p>
        <h1
          className="font-serif font-bold mt-5 max-w-[20ch]"
          style={{
            fontSize: "clamp(42px, 6.2vw, 88px)",
            lineHeight: 0.92,
            letterSpacing: "-0.03em",
            textWrap: "pretty",
          }}
        >
          A daily desk for partner conversations.
        </h1>
        <p
          className="font-serif mt-6 max-w-[58ch]"
          style={{
            fontSize: "clamp(19px, 2vw, 25px)",
            lineHeight: 1.4,
            color: "var(--color-fg-muted)",
          }}
        >
          Five stories every weekday morning, each one already angled for the three roles
          this business works with. One long read on Sunday. Nothing else.
        </p>
      </section>

      {/* Facts strip */}
      <div
        className={cn(
          GUTTER_X,
          "rule-major rule-band-b mt-9 grid grid-cols-2 lg:grid-cols-4"
        )}
      >
        <Fact label="Daily brief" value="7am AEST" sub="Weekdays" first />
        <Fact
          label="Weekly edition"
          value="Sundays"
          sub={editionCount > 0 ? `${editionCount} published` : "In production"}
        />
        <Fact label="Written by" value="One editor" sub="Ruben Laubscher" />
        <Fact label="Tracking" value="None" sub="No pixels, self-hosted" last />
      </div>

      {/* Body + sidebar */}
      <div className={cn(GUTTER_X, "grid lg:grid-cols-[minmax(0,1.6fr)_1px_minmax(0,1fr)]")}>
        <div className="pt-9 lg:pr-13 min-w-0">
          <blockquote
            className="pl-6 lg:pl-7 m-0"
            style={{ borderLeft: "4px solid var(--color-accent-text)" }}
          >
            <p
              className="font-serif"
              style={{
                fontSize: "clamp(21px, 2.4vw, 29px)",
                lineHeight: 1.26,
                letterSpacing: "-0.03em",
                textWrap: "pretty",
              }}
            >
              &ldquo;The first thing that goes when you get busy is not the important
              work. It is the work that feels optional. The check-in call you meant to
              make. The article you bookmarked. The follow-up you drafted but never
              sent.&rdquo;
            </p>
          </blockquote>

          <div className="mt-8 max-w-[66ch]">
            <p style={{ fontSize: 18, lineHeight: 1.7, color: "var(--color-fg-body)" }}>
              The Desk runs two scans. The daily one lands at seven in the morning Sydney
              time with five stories the partner channel should know about, each angled
              for the three partner roles Ruben works with: brokers, advisers and
              accountants, and buyer&apos;s agents.
            </p>
            <p
              className="mt-5"
              style={{ fontSize: 18, lineHeight: 1.7, color: "var(--color-fg-body)" }}
            >
              Sundays the weekly edition lands. Long-form pieces, market metrics, signals
              worth tracking, and Ruben&apos;s Take, a short editorial opinion that opens
              the issue.
            </p>
          </div>

          <SectionHead>How to use it</SectionHead>
          <div className="mt-5 grid sm:grid-cols-2">
            {HOW_TO_USE.map((line, i) => (
              <div
                key={i}
                className={cn(
                  "rule-hair py-4",
                  i % 2 === 0 ? "sm:pr-6 sm:rule-hair-r" : "sm:pl-6"
                )}
              >
                <p
                  className="font-mono tabular-nums"
                  style={{ fontSize: 11, color: "var(--color-accent-text)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </p>
                <p
                  className="mt-2"
                  style={{ fontSize: 16.5, lineHeight: 1.55, color: "var(--color-fg-body)" }}
                >
                  {line}
                </p>
              </div>
            ))}
          </div>

          <SectionHead>How we use AI</SectionHead>
          <div className="mt-5 max-w-[66ch]">
            <p style={{ fontSize: 18, lineHeight: 1.7, color: "var(--color-fg-body)" }}>
              One specific job: drafting the per-role angles after a story has been
              selected and summarised. The editor picks the story, frames it and writes
              the take. The model helps phrase the three lines so each role gets language
              tuned to their conversation.
            </p>
            <p
              className="mt-5"
              style={{ fontSize: 18, lineHeight: 1.7, color: "var(--color-fg-body)" }}
            >
              Full disclosure sits on the{" "}
              <Link
                href="/editorial-standards"
                style={{
                  color: "var(--color-accent-text)",
                  borderBottom: "1px solid var(--color-accent-text)",
                }}
              >
                editorial standards
              </Link>{" "}
              page, alongside the corrections policy.
            </p>
          </div>

          <SectionHead>Built for the partner channel</SectionHead>
          <p
            className="mt-5 max-w-[66ch]"
            style={{ fontSize: 18, lineHeight: 1.7, color: "var(--color-fg-body)" }}
          >
            Information density is the point. The Desk should make a partner conversation
            measurably sharper. If a page is making you scroll past whitespace, the page
            is wrong.
          </p>
        </div>

        <div
          className="hidden lg:block"
          style={{ background: "var(--color-border)" }}
          aria-hidden="true"
        />

        <aside className="pt-9 lg:pl-11 min-w-0">
          <div
            className="p-6"
            style={{
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-elevated)",
            }}
          >
            <p className="bs-label-accent" style={{ letterSpacing: "0.22em" }}>
              Curator
            </p>
            <div className="flex items-center gap-4 mt-4">
              <Headshot />
              <div className="min-w-0">
                <h2
                  className="font-serif font-bold"
                  style={{ fontSize: 26, lineHeight: 1.1 }}
                >
                  Ruben Laubscher
                </h2>
                <p
                  className="mt-2 text-[var(--color-fg-muted)]"
                  style={{ fontSize: 13.5, lineHeight: 1.45 }}
                >
                  Head of Partnerships,
                  <br />
                  InvestorKit · Sydney
                </p>
              </div>
            </div>
            <p
              className="mt-4"
              style={{ fontSize: 15, lineHeight: 1.6, color: "var(--color-fg-body)" }}
            >
              Spends his week talking to brokers, advisers and buyer&apos;s agents. The
              Desk is the reading he was already doing, written down.
            </p>
            <div className="flex gap-2 mt-4 flex-wrap">
              <LinkChip href={LINKEDIN_URL} icon={<Linkedin className="h-3 w-3" />}>
                LinkedIn
              </LinkChip>
              <LinkChip href={INSTAGRAM_URL} icon={<Instagram className="h-3 w-3" />}>
                Instagram
              </LinkChip>
              <LinkChip href={SUBSTACK_URL}>Substack ↗</LinkChip>
            </div>
          </div>

          <div className="mt-6">
            <p className="bs-label mb-1" style={{ letterSpacing: "0.22em" }}>
              Production
            </p>
            <dl className="grid grid-cols-[124px_minmax(0,1fr)] m-0">
              <ProductionRow label="Edition" value="Sunday 7am AEST" first />
              <ProductionRow label="Daily" value="Weekdays 7am AEST" />
              <ProductionRow label="Authority" value="Ruben Laubscher" />
              <ProductionRow label="Location" value="Sydney · GMT+11" last />
            </dl>
          </div>
        </aside>
      </div>

      <SubscribeBand
        source="about-foot"
        headline="Start tomorrow with the five stories and the lines already written."
        blurb=""
        showHeadshot={false}
      />
    </div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-serif font-bold rule-major mt-11 pt-6"
      style={{ fontSize: "clamp(28px, 3vw, 38px)", lineHeight: 1.06, letterSpacing: "-0.03em" }}
    >
      {children}
    </h2>
  );
}

function Fact({
  label,
  value,
  sub,
  first = false,
  last = false,
}: {
  label: string;
  value: string;
  sub: string;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "py-5",
        first ? "pr-5" : "lg:rule-hair-l lg:pl-5",
        !last && "lg:pr-5",
        !first && !last && "pr-5"
      )}
    >
      <p className="bs-label" style={{ letterSpacing: "0.18em" }}>
        {label}
      </p>
      <p className="font-serif font-bold mt-2" style={{ fontSize: 30, lineHeight: 1 }}>
        {value}
      </p>
      <p className="bs-label mt-1.5" style={{ letterSpacing: "0.1em" }}>
        {sub}
      </p>
    </div>
  );
}

function ProductionRow({
  label,
  value,
  first = false,
  last = false,
}: {
  label: string;
  value: string;
  first?: boolean;
  last?: boolean;
}) {
  const border = first ? "var(--color-border-strong)" : "var(--color-border)";
  return (
    <>
      <dt
        className="bs-label py-3"
        style={{ letterSpacing: "0.16em", borderTop: `1px solid ${border}` }}
      >
        {label}
      </dt>
      <dd
        className="py-3 m-0"
        style={{
          fontSize: 15,
          borderTop: `1px solid ${border}`,
          borderBottom: last ? "1px solid var(--color-border-strong)" : undefined,
        }}
      >
        {value}
      </dd>
      {last && (
        <span
          className="block"
          style={{ borderBottom: "1px solid var(--color-border-strong)" }}
          aria-hidden="true"
        />
      )}
    </>
  );
}

function LinkChip({
  href,
  icon,
  children,
}: {
  href: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="bs-link inline-flex items-center gap-1.5 rounded-sm px-3 py-2.5"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        border: "1px solid var(--color-border-strong)",
        color: "var(--color-fg-body)",
      }}
    >
      {icon}
      {children}
    </a>
  );
}

function Headshot() {
  const [failed, setFailed] = useState(false);
  return (
    <div className="h-21 w-21 shrink-0 rounded-full overflow-hidden" style={{ width: 84, height: 84 }}>
      {!failed ? (
        <img
          src="/ruben.jpg"
          alt="Ruben Laubscher"
          className="h-full w-full object-cover"
          loading="eager"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className="avatar-initial-disc h-full w-full flex items-center justify-center font-serif font-bold"
          style={{ fontSize: 35 }}
        >
          R
        </div>
      )}
    </div>
  );
}
