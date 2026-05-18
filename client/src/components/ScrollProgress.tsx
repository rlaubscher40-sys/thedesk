/**
 * Thin amber progress bar pinned to the top of the viewport that fills as
 * the user scrolls. Plus a sticky compact masthead that fades in once the
 * user has scrolled past the hero.
 *
 * Scroll source is the closest scrollable ancestor. Uses requestAnimationFrame
 * for smooth updates without per-scroll React renders.
 */
import { useEffect, useRef, useState } from "react";
import { BrandLockup } from "./Logomark";

export function ScrollProgress({ revealAt = 320 }: { revealAt?: number }) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const main = document.querySelector<HTMLElement>("main");
    if (!main) return;

    let raf = 0;
    let pending = false;
    function update() {
      if (!main) return;
      const max = main.scrollHeight - main.clientHeight;
      const pct = max > 0 ? Math.min(1, main.scrollTop / max) : 0;
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${pct})`;
      }
      setRevealed(main.scrollTop > revealAt);
      pending = false;
    }
    function onScroll() {
      if (pending) return;
      pending = true;
      raf = requestAnimationFrame(update);
    }
    update();
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      main.removeEventListener("scroll", onScroll);
    };
  }, [revealAt]);

  return (
    <>
      {/* Progress bar. Sits at the very top of the viewport, scales right. */}
      <div
        className="fixed top-0 inset-x-0 z-40 pointer-events-none"
        style={{ height: 2 }}
        aria-hidden="true"
      >
        <div
          ref={barRef}
          className="h-full origin-left"
          style={{
            background:
              "linear-gradient(90deg, var(--color-amber) 0%, var(--color-amber-bright) 100%)",
            boxShadow: "0 0 12px var(--color-amber-glow)",
            transform: "scaleX(0)",
            transition: "transform 150ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </div>

      {/* Compact sticky masthead. Fades in once the hero scrolls out. */}
      <div
        className="fixed top-0 inset-x-0 z-30 pointer-events-none flex items-center justify-center px-6 py-3"
        style={{
          background: "var(--grad-scroll-progress)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--color-border)",
          transition:
            "opacity 280ms cubic-bezier(0.16, 1, 0.3, 1), transform 280ms cubic-bezier(0.16, 1, 0.3, 1)",
          opacity: revealed ? 1 : 0,
          transform: revealed ? "translateY(0)" : "translateY(-110%)",
        }}
        aria-hidden={!revealed}
      >
        <BrandLockup size={24} byline={false} />
      </div>
    </>
  );
}
