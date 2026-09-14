/**
 * Subscribe band — the inverted ink panel that closes every page.
 *
 * A 1.3fr / 1fr split: headline on the left, inline email + button on the
 * right, with the curator's headshot and a social-proof line beneath.
 * Wired to the same `useSubscribe` hook as every other subscribe surface,
 * so validation, honeypot handling and the deliberately uniform success
 * copy can't drift between them.
 *
 * On the navy canvas there is no "more ink" to invert into, so `.bs-ink-band`
 * turns this into an elevated panel ringed in amber instead.
 */
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Honeypot } from "@/components/Honeypot";
import { hasSubscribed, useSubscribe } from "@/lib/useSubscribe";
import { GUTTER_X } from "./tokens";
import { Link } from "wouter";
import { NEWSLETTER_NOTICE } from "@shared/legal";

export function SubscribeBand({
  source,
  kicker = "The Daily Brief · free",
  headline = "Five stories and three ready-made lines, in your inbox at 7am.",
  blurb = "Curated by Ruben Laubscher with AI-assisted reporting. Weekdays at 7am Sydney time, plus the Sunday edition. Unsubscribe in a click.",
  showHeadshot = true,
  hideAfterSignup = true,
}: {
  /** Attribution source persisted with the subscriber row. */
  source: string;
  kicker?: string;
  headline?: string;
  blurb?: string;
  showHeadshot?: boolean;
  /** Passive placements hide after a request; the explicit signup page stays usable. */
  hideAfterSignup?: boolean;
}) {
  // Read once on mount so the band doesn't disappear from under the reader
  // the instant they submit — the confirmation state handles that.
  const [alreadySubscribed] = useState(hasSubscribed);
  const [done, setDone] = useState(false);
  const { email, setEmail, hp, setHp, submit, busy, error, submittedEmail } = useSubscribe({
    source,
    onSubscribed: () => setDone(true),
  });

  if (alreadySubscribed && hideAfterSignup) return null;

  return (
    <section
      className={cn(
        GUTTER_X,
        "bs-ink-band mt-12 lg:mt-14 grid gap-8 lg:gap-14 px-6 py-9 lg:px-12 lg:py-11",
        "lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-center"
      )}
    >
      {/* min-w-0 on both columns: without it a grid child's min-content
          width is its longest unbreakable run, and the blurb's 52ch cap
          pushed the band past the gutter at 390px. */}
      <div className="min-w-0">
        <p className="bs-label" style={{ color: "oklch(0.80 0.17 72)" }}>
          {kicker}
        </p>
        <h2
          className="font-serif font-bold mt-3.5 max-w-[26ch]"
          style={{
            fontSize: "clamp(1.625rem, 3.2vw, 2.375rem)",
            lineHeight: 1.06,
            color: "inherit",
          }}
        >
          {headline}
        </h2>
        {blurb && (
          <p
            className="bs-band-muted mt-3.5 max-w-[52ch]"
            style={{ fontSize: "1.03125rem", lineHeight: 1.6 }}
          >
            {blurb}
          </p>
        )}
      </div>

      <div className="min-w-0">
        {done ? (
          <div role="status" className="text-base leading-7">
            <p>
              Check your inbox at <strong className="break-all">{submittedEmail}</strong>. Follow
              the email instructions to confirm or manage your subscription.
            </p>
            <p className="text-sm mt-2">
              Allow a few minutes and check spam. Requesting an email does not confirm your
              subscription.
            </p>
            <button
              className="bs-btn mt-3 underline"
              onClick={() => {
                setEmail(submittedEmail);
                setDone(false);
              }}
            >
              Edit address or request another email
            </button>
          </div>
        ) : (
          <form
            onSubmit={submit}
            noValidate
            className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2.5"
          >
            <label className="text-sm sm:col-span-2" htmlFor={`subscribe-${source}`}>
              Email address
            </label>
            <input
              id={`subscribe-${source}`}
              type="email"
              required
              aria-invalid={!!error}
              aria-describedby={`subscribe-notice-${source}${error ? ` subscribe-error-${source}` : ""}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@firm.com"
              autoComplete="email"
              className="flex-1 min-w-0 rounded-sm px-4 py-3.5"
              style={{
                fontSize: "1rem",
                fontFamily: "var(--font-sans)",
                background: "oklch(0 0 0 / 28%)",
                border: "1px solid oklch(1 0 0 / 16%)",
                color: "inherit",
              }}
            />
            <Honeypot value={hp} onChange={setHp} />
            <button
              type="submit"
              disabled={busy}
              className="bs-btn shrink-0 disabled:opacity-60"
              style={{
                border: 0,
                background: "oklch(0.80 0.17 72)",
                color: "oklch(0.14 0.018 260)",
                padding: "14px 22px",
              }}
            >
              {busy ? "Sending…" : "Subscribe"}
            </button>
            {error && (
              <p id={`subscribe-error-${source}`} role="alert" className="text-sm sm:col-span-2">
                {error}
              </p>
            )}
            <p id={`subscribe-notice-${source}`} className="text-sm leading-6 sm:col-span-2">
              {NEWSLETTER_NOTICE}{" "}
              <Link href="/privacy" className="underline">
                Privacy
              </Link>
              .
            </p>
          </form>
        )}

        {showHeadshot ? (
          <div className="flex items-center gap-3.5 mt-4">
            <img
              src="/ruben.jpg"
              alt=""
              width={40}
              height={40}
              loading="lazy"
              decoding="async"
              className="h-10 w-10 rounded-full object-cover shrink-0"
            />
            <p className="bs-label" style={{ lineHeight: 1.6, letterSpacing: "0.14em" }}>
              Read by brokers, advisers and buyer&apos;s agents across Australia
            </p>
          </div>
        ) : (
          <p className="bs-label mt-3.5" style={{ letterSpacing: "0.14em" }}>
            No tracking pixels · unsubscribe in one click
          </p>
        )}
      </div>
    </section>
  );
}
