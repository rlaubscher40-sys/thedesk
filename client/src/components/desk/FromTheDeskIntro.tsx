/**
 * Prominent author strip that sits just below the Hero on Today. Bigger
 * than the CuratorByline used inside cards, this one's the "if you don't
 * know who Ruben is yet, here's why his read on the day is worth your
 * time" moment.
 *
 * Hidden on narrow screens by collapsing into a single line; on desktop
 * the headshot is 80px with a real intro sentence.
 */
import { ExternalLink, Linkedin } from "lucide-react";
import { useState } from "react";

const SUBSTACK_URL = "https://rubenlaubscher.substack.com/";
const LINKEDIN_URL = "https://www.linkedin.com/in/ruben-laubscher/";

export function FromTheDeskIntro() {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <section
      className="panel rounded-sm p-5 sm:p-7 flex items-center gap-5 sm:gap-7"
      style={{ background: "var(--grad-panel-soft)" }}
    >
      <div className="relative shrink-0">
        <div
          className="rounded-full overflow-hidden"
          style={{
            width: 72,
            height: 72,
            boxShadow:
              "inset 0 0 0 1px oklch(1 0 0 / 12%), 0 6px 20px oklch(0 0 0 / 35%)",
          }}
        >
          {!imgFailed ? (
            <img
              src="/ruben.jpg"
              alt="Ruben Laubscher"
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div
              className="avatar-initial-disc w-full h-full flex items-center justify-center font-serif font-bold text-3xl"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.32 0.06 260), oklch(0.16 0.04 260) 60%, oklch(0.32 0.18 70 / 50%))",
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
              "0 0 0 1px oklch(0.75 0.18 70 / 32%), 0 0 18px oklch(0.75 0.18 70 / 18%)",
          }}
          aria-hidden="true"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className="overline-amber"
          style={{ letterSpacing: "0.24em", fontSize: "10px" }}
        >
          From Ruben's desk
        </p>
        <h2 className="font-serif text-xl sm:text-2xl font-semibold leading-tight mt-1">
          Ruben Laubscher
        </h2>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1.5 leading-snug max-w-[60ch]">
          One daily read for the partner channel, built so brokers, advisers,
          accountants and buyer's agents walk into the next conversation
          sharper than the last.
        </p>
        <div className="flex items-center gap-2 mt-3 sm:hidden">
          <a
            href={LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ruben Laubscher on LinkedIn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[10px] font-mono uppercase tracking-[0.16em] border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] transition-colors"
          >
            <Linkedin className="h-3 w-3" />
            LinkedIn
          </a>
          <a
            href={SUBSTACK_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ruben Laubscher's Substack"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[10px] font-mono uppercase tracking-[0.16em] border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Substack
          </a>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <a
          href={LINKEDIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ruben Laubscher on LinkedIn"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[10px] font-mono uppercase tracking-[0.16em] border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] transition-colors"
        >
          <Linkedin className="h-3 w-3" />
          LinkedIn
        </a>
        <a
          href={SUBSTACK_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ruben Laubscher's Substack"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[10px] font-mono uppercase tracking-[0.16em] border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Substack
        </a>
      </div>
    </section>
  );
}
