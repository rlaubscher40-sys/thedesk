/**
 * Wraps a list of children so each fades + slides in with a stagger delay.
 * Light Framer Motion sugar, drop it around any grid or vertical list and
 * its direct children animate on mount and on key change.
 */
import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

// The brand-canonical easing curve (see index.css). Repeated literally
// here because Framer Motion's variants type requires the tuple.
const BRAND_EASE = [0.16, 1, 0.3, 1] as const;

type Props = {
  className?: string;
  /** Delay between siblings in seconds. */
  stagger?: number;
  /** Initial vertical offset in px. */
  yOffset?: number;
  /** Forces re-mount on change, useful when the underlying list changes. */
  cacheKey?: string;
  children: ReactNode;
};

export function StaggerList({
  className,
  stagger = 0.045,
  yOffset = 8,
  cacheKey,
  children,
}: Props) {
  const reduced = useReducedMotion();
  const container: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduced ? 0 : stagger, delayChildren: 0.02 },
    },
  };
  const item: Variants = reduced
    ? { hidden: {}, show: {} }
    : {
        hidden: { opacity: 0, y: yOffset },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease: BRAND_EASE },
        },
      };

  return (
    <motion.div
      key={cacheKey}
      className={className}
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Wrap each direct child in motion.div so the cascade applies even
          when consumers pass plain elements. */}
      {Array.isArray(children)
        ? children.map((child, i) => (
            <motion.div key={i} variants={item}>
              {child}
            </motion.div>
          ))
        : <motion.div variants={item}>{children}</motion.div>}
    </motion.div>
  );
}
