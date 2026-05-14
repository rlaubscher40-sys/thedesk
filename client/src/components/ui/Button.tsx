/**
 * Tiny button primitive. shadcn-shaped but stripped to only the variants we
 * actually use here.
 */
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--color-amber)] text-[oklch(0.13_0.018_260)] hover:bg-[var(--color-amber-bright)] hover:shadow-[0_0_24px_oklch(0.75_0.18_70/35%)]",
        ghost:
          "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-white/5",
        outline:
          "border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-amber-400/40 hover:text-[var(--color-fg)] hover:bg-white/[0.03]",
        danger: "bg-red-500/10 text-red-300 hover:bg-red-500/20",
      },
      size: {
        sm: "h-7 px-2.5 text-xs rounded",
        md: "h-9 px-3.5 text-sm rounded",
        lg: "h-11 px-5 text-base rounded-md",
        icon: "h-8 w-8 rounded",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, ...props },
  ref
) {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonStyles({ variant, size }), className)} {...props} />;
});
