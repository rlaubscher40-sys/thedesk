/**
 * Animated number tween. Counts up from 0 (or from a previous value) to
 * the target on mount and when the target changes. Used on KPI tiles so
 * a metric like "4.35%" doesn't just snap into view — it dials.
 *
 * Honours prefers-reduced-motion by jumping straight to the final value.
 */
import { useEffect, useRef, useState } from "react";

type Props = {
  /** Target value. */
  value: number;
  /** Tween duration in ms. */
  duration?: number;
  /** Decimal places to render. */
  decimals?: number;
  /** Trailing suffix (e.g. "%"). */
  suffix?: string;
  /** Use locale-aware grouping commas. */
  group?: boolean;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function CountUp({
  value,
  duration = 900,
  decimals = 2,
  suffix = "",
  group = false,
}: Props) {
  const [shown, setShown] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    if (start === end) {
      setShown(end);
      return;
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(end);
      prevRef.current = end;
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const next = start + (end - start) * easeOutCubic(t);
      setShown(next);
      if (t < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = end;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const formatted = group
    ? shown.toLocaleString("en-AU", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : shown.toFixed(decimals);

  return (
    <span className="tabular-nums">
      {formatted}
      {suffix}
    </span>
  );
}
