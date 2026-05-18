/**
 * Canvas-based atmospheric backdrop.
 *
 * Replaces the CSS gradient orbs with a real particle field, a slow
 * constellation of dots with thin connection lines, a handful of vertical
 * data-stream slivers that climb the right edge, and an occasional
 * full-height scan line sweeping top-to-bottom. Pure canvas, no per-frame
 * React renders.
 *
 * Performance: capped at 50fps via timestamp gate, particle count scales
 * with viewport area, animation is paused when the tab is hidden, and the
 * whole thing is disabled when prefers-reduced-motion is set.
 */
import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hue: number;
  twinkle: number;
};

type DataStream = {
  x: number;
  y: number;
  speed: number;
  length: number;
};

type ScanLine = {
  y: number;
  speed: number;
};

const TARGET_FPS = 50;
const FRAME_BUDGET = 1000 / TARGET_FPS;

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    // Mobile bails out, the particle field's O(n²) connection-line pass
    // is the most expensive frame in the app, and on a mid-range Android
    // it shows up in Lighthouse as main-thread blocking. The static
    // gradient washes below the canvas still render so the look survives.
    const isSmallViewport =
      typeof window !== "undefined" && window.innerWidth < 768;
    if (isSmallViewport) return;

    // Light mode reads as paper, the indigo particle field looks wrong
    // floating on a warm-white canvas. Skip the canvas entirely when
    // the .light class is on the html element.
    if (
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("light")
    ) {
      return;
    }

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = window.innerWidth;
    let height = window.innerHeight;
    let particles: Particle[] = [];
    let streams: DataStream[] = [];
    let scanLines: ScanLine[] = [];
    let raf = 0;
    let lastFrame = 0;
    let scanCooldown = 6000; // ms until next scan-line spawns

    function sizeCanvas() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      if (!canvas) return;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function seed() {
      // Particle count scales with area. ~1 per 14000px², bounded.
      const target = Math.min(140, Math.max(45, Math.floor((width * height) / 14000)));
      particles = Array.from({ length: target }).map(() => spawnParticle());
      streams = Array.from({ length: 8 }).map(() => spawnStream());
      scanLines = [];
    }

    function spawnParticle(): Particle {
      // Most particles cool/navy, a small minority amber for warmth.
      const amber = Math.random() < 0.18;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.06,
        vy: (Math.random() - 0.5) * 0.06,
        r: 0.6 + Math.random() * 1.2,
        hue: amber ? 38 + Math.random() * 8 : 218 + Math.random() * 20,
        twinkle: Math.random() * Math.PI * 2,
      };
    }

    function spawnStream(): DataStream {
      return {
        x: width - 40 - Math.random() * (width * 0.4),
        y: -Math.random() * height,
        speed: 0.3 + Math.random() * 0.6,
        length: 60 + Math.random() * 220,
      };
    }

    function spawnScan(): ScanLine {
      return { y: -2, speed: 0.7 + Math.random() * 0.5 };
    }

    function step(now: number) {
      raf = requestAnimationFrame(step);
      if (now - lastFrame < FRAME_BUDGET) return;
      const dt = lastFrame === 0 ? 16 : now - lastFrame;
      lastFrame = now;

      // Clear with a faint trail-fade so motion leaves a soft tail.
      ctx!.fillStyle = "oklch(0.11 0.018 260 / 0.34)";
      ctx!.fillRect(0, 0, width, height);

      // ── Particles ─────────────────────────────────────────────────
      for (const p of particles) {
        p.x += p.vx * dt * 0.05;
        p.y += p.vy * dt * 0.05;
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;
        p.twinkle += 0.02;
        const alpha = 0.22 + Math.sin(p.twinkle) * 0.08;
        ctx!.beginPath();
        ctx!.fillStyle = `hsl(${p.hue}, 80%, 70% / ${alpha})`;
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fill();
      }

      // Connection lines for close particle pairs.
      const connDist = 130;
      const connDistSq = connDist * connDist;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]!;
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < connDistSq) {
            const t = 1 - d2 / connDistSq;
            ctx!.strokeStyle = `hsl(220, 40%, 70% / ${t * 0.08})`;
            ctx!.lineWidth = 0.5;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }

      // ── Data streams (vertical slivers) ──────────────────────────
      for (const s of streams) {
        s.y += s.speed * dt * 0.06;
        if (s.y - s.length > height) Object.assign(s, spawnStream(), { y: -s.length });
        const grad = ctx!.createLinearGradient(s.x, s.y - s.length, s.x, s.y);
        grad.addColorStop(0, "hsla(38, 95%, 65%, 0)");
        grad.addColorStop(0.6, "hsla(38, 95%, 65%, 0.04)");
        grad.addColorStop(1, "hsla(38, 95%, 75%, 0.18)");
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 0.8;
        ctx!.beginPath();
        ctx!.moveTo(s.x, s.y - s.length);
        ctx!.lineTo(s.x, s.y);
        ctx!.stroke();
      }

      // ── Scan line, spawns occasionally, sweeps the viewport ─────
      scanCooldown -= dt;
      if (scanCooldown <= 0) {
        scanLines.push(spawnScan());
        scanCooldown = 7000 + Math.random() * 6000;
      }
      for (let i = scanLines.length - 1; i >= 0; i--) {
        const s = scanLines[i]!;
        s.y += s.speed * dt * 0.5;
        if (s.y > height + 20) {
          scanLines.splice(i, 1);
          continue;
        }
        const grad = ctx!.createLinearGradient(0, s.y - 4, 0, s.y + 4);
        grad.addColorStop(0, "hsla(38, 90%, 80%, 0)");
        grad.addColorStop(0.5, "hsla(38, 90%, 80%, 0.14)");
        grad.addColorStop(1, "hsla(38, 90%, 80%, 0)");
        ctx!.fillStyle = grad;
        ctx!.fillRect(0, s.y - 4, width, 8);
      }
    }

    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (raf === 0) {
        lastFrame = 0;
        raf = requestAnimationFrame(step);
      }
    }

    sizeCanvas();
    raf = requestAnimationFrame(step);
    window.addEventListener("resize", sizeCanvas);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", sizeCanvas);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
        aria-hidden="true"
      />
      {/* A pair of soft gradient washes sit above the canvas to anchor
          the colour palette, amber upper-right, indigo lower-left. */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
        aria-hidden="true"
      >
        <div
          className="absolute"
          style={{
            top: "-25%",
            right: "-10%",
            width: 900,
            height: 900,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, oklch(0.75 0.18 70 / 7%) 0%, transparent 60%)",
            filter: "blur(80px)",
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: "-25%",
            left: "-10%",
            width: 800,
            height: 800,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, oklch(0.55 0.18 270 / 6%) 0%, transparent 60%)",
            filter: "blur(80px)",
          }}
        />
      </div>
      <div className="noise-overlay" aria-hidden="true" />
    </>
  );
}
