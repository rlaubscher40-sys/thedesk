/**
 * 404 — Signal lost.
 *
 * Editorial treatment instead of a default error page: oversized serif
 * "404" with a scan-line glitch effect, a "TRANSMISSION LOST" overline,
 * a short editorial line, and a couple of routes back into the app.
 */
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="relative max-w-2xl mx-auto px-6 py-16 text-center">
        {/* Scan-line band sitting behind the 404 glyph. */}
        <div
          className="absolute inset-x-0 top-1/3 h-32 pointer-events-none"
          style={{
            background:
              "repeating-linear-gradient(180deg, transparent 0 5px, oklch(0.75 0.18 70 / 8%) 5px 6px)",
          }}
          aria-hidden="true"
        />

        <p
          className="overline-amber mb-6 first-paint-mark"
          style={{ letterSpacing: "0.3em", fontSize: "11px" }}
        >
          ● Transmission lost
        </p>

        <h1
          className="font-serif font-bold relative mb-8 first-paint-content"
          style={{
            fontSize: "clamp(128px, 22vw, 256px)",
            lineHeight: "0.9",
            letterSpacing: "-0.04em",
          }}
        >
          <span
            className="block"
            style={{
              background:
                "linear-gradient(180deg, oklch(0.96 0.08 88) 0%, oklch(0.82 0.20 76) 55%, oklch(0.45 0.10 60) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: "drop-shadow(0 0 30px oklch(0.75 0.18 70 / 25%))",
            }}
          >
            404
          </span>
        </h1>

        <p className="font-serif italic text-xl text-[var(--color-fg-muted)] mb-12 leading-snug max-w-xl mx-auto">
          That signal hasn't reached this frequency. Most pages on The Desk live behind one of the routes below — try one.
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <RouteButton href="/">Today</RouteButton>
          <RouteButton href="/editions">Editions</RouteButton>
          <RouteButton href="/trends">Trends</RouteButton>
          <RouteButton href="/archive">Archive</RouteButton>
        </div>
      </div>
    </div>
  );
}

function RouteButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-sm px-4 py-2.5 text-xs font-mono uppercase tracking-[0.18em] border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-amber-400/40 transition-colors"
    >
      {children}
      <ArrowRight className="h-3 w-3" />
    </Link>
  );
}
