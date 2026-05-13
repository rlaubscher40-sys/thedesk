/**
 * Atmospheric backdrop sitting behind every page. Three slowly-drifting
 * gradient orbs and a subtle film grain overlay. Both are fixed-position,
 * pointer-events:none, and z-indexed below all real content.
 *
 * Pure CSS — no JS animation loop — so it doesn't compete with the rest of
 * the app for the main thread.
 */
export function AnimatedBackground() {
  return (
    <>
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 0 }}
        aria-hidden="true"
      >
        <div
          className="ambient-orb-1 absolute"
          style={{
            top: "-15%",
            right: "5%",
            width: 720,
            height: 720,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, oklch(0.75 0.18 70 / 9%) 0%, transparent 60%)",
            filter: "blur(80px)",
          }}
        />
        <div
          className="ambient-orb-2 absolute"
          style={{
            bottom: "-20%",
            left: "-5%",
            width: 640,
            height: 640,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, oklch(0.55 0.18 270 / 7%) 0%, transparent 60%)",
            filter: "blur(80px)",
          }}
        />
        <div
          className="ambient-orb-3 absolute"
          style={{
            top: "35%",
            left: "32%",
            width: 460,
            height: 460,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, oklch(0.62 0.15 195 / 5%) 0%, transparent 60%)",
            filter: "blur(80px)",
          }}
        />
      </div>
      <div className="noise-overlay" aria-hidden="true" />
    </>
  );
}
