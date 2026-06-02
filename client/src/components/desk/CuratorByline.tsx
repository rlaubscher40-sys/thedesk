/**
 * Tiny "Curated by Ruben Laubscher" micro-byline. Sits at the bottom of
 * every Featured / Story card so the personal-brand attribution is
 * always present without being noisy.
 *
 * 28px circular headshot + "CURATED · RUBEN LAUBSCHER" mono caption.
 * Whole row is a link to Ruben's LinkedIn profile.
 */
import { useState } from "react";

const HEADSHOT = "/ruben.jpg";
const LINKEDIN = "https://www.linkedin.com/in/ruben-laubscher/";

export function CuratorByline() {
  const [failed, setFailed] = useState(false);
  return (
    <a
      href={LINKEDIN}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 inline-flex items-center gap-2 group"
      aria-label="Curated by Ruben Laubscher, open LinkedIn"
    >
      <span
        className="block rounded-full overflow-hidden relative shrink-0"
        style={{
          width: 22,
          height: 22,
          boxShadow:
            "inset 0 0 0 1px oklch(0.75 0.18 70 / 35%), 0 0 0 1px oklch(1 0 0 / 8%)",
        }}
      >
        {!failed ? (
          <img
            src={HEADSHOT}
            alt="Ruben Laubscher"
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        ) : (
          <span
            className="avatar-initial-disc w-full h-full flex items-center justify-center font-serif font-bold text-[10px]"
            aria-hidden="true"
          >
            R
          </span>
        )}
      </span>
      <span
        className="font-mono uppercase text-[var(--color-fg-subtle)] group-hover:text-amber-300 transition-colors"
        style={{ fontSize: "10px", letterSpacing: "0.2em" }}
      >
        Curated · Ruben Laubscher
      </span>
    </a>
  );
}
