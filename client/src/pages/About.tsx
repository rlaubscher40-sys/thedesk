/**
 * About page — editorial broadsheet layout. Two changes after the v1
 * audit: the wordmark in the hero was clipping at the left edge ("p" of
 * "partner conversations." cut off because the gradient text bleed
 * landed outside the bounding box), and the prose column was max-w-68ch
 * centered on a wide canvas so the page felt squished even though it
 * had room to breathe.
 *
 * Now: hero text has explicit padding-left and a wider clamp; the body
 * uses a magazine-style two-column grid on lg+ (prose on the left,
 * author + production meta sidebar on the right) so the page actually
 * uses the canvas. Mobile stacks them linearly.
 */
import { useState } from "react";
import { ExternalLink, Linkedin } from "lucide-react";

const SUBSTACK_URL = "https://rubenlaubscher.substack.com/";
const LINKEDIN_URL = "https://www.linkedin.com/in/ruben-laubscher/";

export default function About() {
  return (
    <div className="space-y-12">
      {/* Hero — full-bleed editorial header. Title gets its own padding
          on every edge so the gradient text doesn't clip at the left. */}
      <section
        className="relative overflow-hidden rounded-sm panel"
        style={{ minHeight: "clamp(320px, 42vh, 520px)" }}
      >
        <img
          src="/about-hero.svg"
          alt=""
          aria-hidden="true"
          className="hero-cover-img absolute inset-0 w-full h-full object-cover"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
        <span className="hero-cover-shine absolute inset-0" aria-hidden="true" />
        <div
          className="absolute inset-0"
          style={{ background: "var(--grad-hero-overlay)" }}
        />
        <div
          className="absolute inset-0 rounded-sm pointer-events-none"
          style={{ boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 6%)" }}
        />
        <div className="relative h-full flex flex-col justify-end p-8 sm:p-12 lg:p-16">
          <p
            className="overline-amber mb-4"
            style={{ letterSpacing: "0.26em", fontSize: "10px" }}
          >
            About · The Desk
          </p>
          <h1
            className="font-serif font-bold tracking-tight"
            style={{
              fontSize: "clamp(44px, 6vw, 84px)",
              lineHeight: "0.98",
              // Explicit padding-left so the italic descenders of the
              // gradient text don't crop at the panel edge.
              paddingLeft: "2px",
              maxWidth: "22ch",
            }}
          >
            <span className="block first-paint-mark">A daily desk for</span>
            <span
              className="block first-paint-content"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.96 0.08 88) 0%, oklch(0.82 0.20 76) 60%, oklch(0.65 0.16 60) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                // Tiny right-pad too, keeps the trailing period inside
                // the gradient bounding box on big screens.
                paddingRight: "0.08em",
              }}
            >
              partner conversations.
            </span>
          </h1>
        </div>
      </section>

      {/* Two-column editorial body. Prose on the left at a comfortable
          reading width; the author + meta sidebar on the right uses the
          rest of the canvas. Stacks on mobile, prose first then sidebar. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-10 lg:gap-14 pb-16">
        {/* ── Prose column. */}
        <article className="text-[var(--color-fg)] space-y-6 leading-relaxed">
          <p
            className="font-serif text-2xl italic text-[var(--color-fg-muted)] leading-snug border-l-2 pl-5 my-2"
            style={{ borderColor: "var(--color-amber)" }}
          >
            "The first thing that goes when you get busy is not the important
            work. It is the work that feels optional. The check-in call you
            meant to make. The article you bookmarked. The follow-up you
            drafted but never sent."
          </p>

          <p>
            The Desk runs two scans. The daily one lands at seven in the
            morning Sydney time with five stories the partner channel should
            know about, each tagged for the four personas Ruben works with:
            Brokers, Financial Advisers, Accountants, SMSF Specialists.
          </p>
          <p>
            Sundays the weekly edition lands. Long-form pieces, market
            metrics, signals worth tracking, and Ruben's Take — a 2 to 4
            sentence editorial opinion that opens the issue. From there a
            full Substack draft is one click away.
          </p>

          <h2 className="font-serif text-3xl font-bold mt-12 mb-5 leading-tight">
            How to use it
          </h2>
          <ul className="space-y-3 not-italic list-none p-0">
            {[
              "Open Today first thing. Copy a Say This line into a partner conversation.",
              "Drop saved articles into the Reading Queue. Tag and triage them when you have a minute.",
              "Open Editions on Sunday for the weekly deep dive — long-form, with the take, signals, and dates to watch.",
              "Press / from anywhere to search. ⌘K opens the command palette.",
            ].map((line, i) => (
              <li key={i} className="flex gap-4 items-baseline">
                <span className="font-mono text-amber-400 tabular-nums shrink-0 mt-1">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <h2 className="font-serif text-3xl font-bold mt-12 mb-5 leading-tight">
            Built for the partner channel
          </h2>
          <p>
            Information density is the point. The Desk should make a partner
            conversation measurably sharper. If a page is making you scroll
            past whitespace, the page is wrong.
          </p>
          <p>
            Built by Ruben Laubscher, Head of Partnerships at InvestorKit
            (Australia's most awarded buyer's agency). The Desk is private —
            partners and the firm only.
          </p>

          <h2 className="font-serif text-3xl font-bold mt-12 mb-5 leading-tight">
            How we use AI
          </h2>
          <p>
            The Desk uses large language models for one specific job:
            drafting per-persona angles after a story has been selected and
            summarised. The human editor picks the story, frames it, and
            writes the take. The AI helps phrase the four "Say This" lines so
            each persona — broker, adviser, accountant, buyer's agent — gets
            language tuned to their conversation. Full disclosure is on the{" "}
            <a
              href="/editorial-standards"
              className="text-amber-300 hover:text-amber-200 transition-colors"
            >
              editorial standards
            </a>{" "}
            page.
          </p>
        </article>

        {/* ── Sidebar — author card + production meta. Sticky on lg+ so
            it stays visible as the prose scrolls. */}
        <aside className="lg:sticky lg:top-8 self-start space-y-6">
          <div
            className="panel rounded-sm p-6 sm:p-7"
            style={{ background: "var(--grad-panel-soft)" }}
          >
            <div className="flex items-center gap-5">
              <AuthorHeadshot />
              <div className="min-w-0 flex-1">
                <p
                  className="overline-amber"
                  style={{ letterSpacing: "0.22em", fontSize: "9px" }}
                >
                  Curator
                </p>
                <h2 className="font-serif text-2xl font-bold leading-tight mt-1">
                  Ruben Laubscher
                </h2>
                <p className="text-xs text-[var(--color-fg-muted)] mt-1.5 leading-snug">
                  Head of Partnerships, InvestorKit. Sydney.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-5 flex-wrap">
              <a
                href={LINKEDIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[10px] font-mono uppercase tracking-[0.16em] border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] transition-colors"
              >
                <Linkedin className="h-3 w-3" />
                LinkedIn
              </a>
              <a
                href={SUBSTACK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[10px] font-mono uppercase tracking-[0.16em] border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Substack
              </a>
            </div>
          </div>

          <div className="panel rounded-sm p-6 sm:p-7">
            <p
              className="overline mb-4"
              style={{ letterSpacing: "0.22em" }}
            >
              Production
            </p>
            <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-3">
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)] self-center">
                Edition
              </dt>
              <dd className="text-sm">Sunday 7am AEST</dd>
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)] self-center">
                Daily
              </dt>
              <dd className="text-sm">Weekdays 7am AEST</dd>
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)] self-center">
                Authority
              </dt>
              <dd className="text-sm">Ruben Laubscher · InvestorKit</dd>
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-fg-subtle)] self-center">
                Location
              </dt>
              <dd className="text-sm">Sydney · GMT+11</dd>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

function AuthorHeadshot() {
  const [failed, setFailed] = useState(false);
  const size = 88;
  return (
    <div className="relative shrink-0">
      <div
        className="rounded-full overflow-hidden"
        style={{
          width: size,
          height: size,
          boxShadow:
            "inset 0 0 0 1px oklch(1 0 0 / 12%), 0 8px 28px oklch(0 0 0 / 40%)",
        }}
      >
        {!failed ? (
          <img
            src="/ruben.jpg"
            alt="Ruben Laubscher"
            className="w-full h-full object-cover"
            loading="eager"
            decoding="async"
            onError={() => setFailed(true)}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center font-serif font-bold"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.32 0.06 260), oklch(0.16 0.04 260) 60%, oklch(0.32 0.18 70 / 50%))",
              fontSize: size * 0.42,
              color: "oklch(0.92 0.16 76)",
            }}
          >
            R
          </div>
        )}
      </div>
      <span
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          boxShadow:
            "0 0 0 1px oklch(0.75 0.18 70 / 32%), 0 0 24px oklch(0.75 0.18 70 / 18%)",
        }}
        aria-hidden="true"
      />
    </div>
  );
}
