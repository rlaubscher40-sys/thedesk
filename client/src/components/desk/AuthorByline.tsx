/**
 * Author byline. Two variants:
 *
 *   · "compact" — single row: small avatar + name + role + LinkedIn /
 *     Subscribe chips. The print-magazine byline that sits under a
 *     pull-quote or at the end of an article.
 *
 *   · "card" — larger format with a stacked name+role block. Used in
 *     the sidebar footer where vertical space is plentiful.
 *
 * The headshot is loaded from /ruben.jpg. Falls back to an "R"
 * gradient initial if the image doesn't load.
 */
import { useState } from "react";
import { Linkedin, Rss } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  src?: string;
  name?: string;
  role?: string;
  linkedin?: string;
  substack?: string;
  /** Compact byline (default) or card. */
  variant?: "compact" | "card";
  className?: string;
};

export function AuthorByline({
  src = "/ruben.jpg",
  name = "Ruben Laubscher",
  role = "Head of Partnerships · InvestorKit",
  linkedin = "https://www.linkedin.com/in/ruben-laubscher/",
  substack = "https://rubenlaubscher.substack.com/",
  variant = "compact",
  className,
}: Props) {
  if (variant === "card") {
    return (
      <BylineCard
        src={src}
        name={name}
        role={role}
        linkedin={linkedin}
        substack={substack}
        className={className}
      />
    );
  }
  return (
    <BylineCompact
      src={src}
      name={name}
      role={role}
      linkedin={linkedin}
      substack={substack}
      className={className}
    />
  );
}

// ─── Shared headshot helper ────────────────────────────────────────────────

function Headshot({
  src,
  name,
  size,
}: {
  src: string;
  name: string;
  size: number;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative shrink-0">
      <div
        className="rounded-full overflow-hidden relative"
        style={{
          width: size,
          height: size,
          boxShadow:
            "inset 0 0 0 1px oklch(1 0 0 / 12%), 0 4px 16px oklch(0 0 0 / 35%)",
        }}
      >
        {!failed ? (
          <img
            src={src}
            alt={`${name} headshot`}
            className="w-full h-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center font-serif font-bold"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.32 0.06 260), oklch(0.16 0.04 260) 60%, oklch(0.32 0.18 70 / 50%))",
              fontSize: size * 0.42,
              color: "oklch(0.92 0.16 76)",
            }}
          >
            {name[0]?.toUpperCase()}
          </div>
        )}
      </div>
      <span
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          boxShadow:
            "0 0 0 1px oklch(0.75 0.18 70 / 28%), 0 0 14px oklch(0.75 0.18 70 / 14%)",
        }}
        aria-hidden="true"
      />
    </div>
  );
}

// ─── Compact byline — print-style strip below a quote ──────────────────────

type BylineImpl = {
  src: string;
  name: string;
  role: string;
  linkedin: string;
  substack: string;
  className?: string;
};

function BylineCompact({
  src,
  name,
  role,
  linkedin,
  substack,
  className,
}: BylineImpl) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 flex-wrap",
        className
      )}
    >
      <Headshot src={src} name={name} size={48} />
      <div className="min-w-0 flex-1">
        <p
          className="overline text-[var(--color-fg-subtle)]"
          style={{ letterSpacing: "0.22em" }}
        >
          By
        </p>
        <p className="font-serif text-base font-semibold leading-tight">
          {name}
        </p>
        <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">{role}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ActionChip
          href={linkedin}
          ariaLabel={`${name} on LinkedIn`}
          icon={Linkedin}
        >
          LinkedIn
        </ActionChip>
        <ActionChip
          href={substack}
          ariaLabel={`Subscribe to ${name}'s Substack`}
          icon={Rss}
          primary
        >
          Subscribe
        </ActionChip>
      </div>
    </div>
  );
}

// ─── Card byline — larger stacked block ────────────────────────────────────

function BylineCard({
  src,
  name,
  role,
  linkedin,
  substack,
  className,
}: BylineImpl) {
  return (
    <div
      className={cn("flex items-start gap-4", className)}
    >
      <Headshot src={src} name={name} size={64} />
      <div className="min-w-0">
        <p className="font-serif text-base font-semibold leading-tight">
          {name}
        </p>
        <p
          className="overline mt-1"
          style={{ letterSpacing: "0.16em" }}
        >
          {role}
        </p>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <ActionChip
            href={linkedin}
            ariaLabel={`${name} on LinkedIn`}
            icon={Linkedin}
          >
            LinkedIn
          </ActionChip>
          <ActionChip
            href={substack}
            ariaLabel={`Subscribe to ${name}'s Substack`}
            icon={Rss}
            primary
          >
            Subscribe
          </ActionChip>
        </div>
      </div>
    </div>
  );
}

// ─── Action chip ────────────────────────────────────────────────────────────

function ActionChip({
  href,
  ariaLabel,
  icon: Icon,
  primary = false,
  children,
}: {
  href: string;
  ariaLabel: string;
  icon: typeof Linkedin;
  primary?: boolean;
  children: React.ReactNode;
}) {
  if (primary) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[10px] font-mono uppercase tracking-[0.16em] transition-all active:scale-[0.98]"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.78 0.18 70) 0%, oklch(0.88 0.19 82) 55%, oklch(0.65 0.16 60) 100%)",
          color: "oklch(0.10 0.018 260)",
          boxShadow:
            "0 1px 0 oklch(1 0 0 / 18%) inset, 0 4px 14px oklch(0.75 0.18 70 / 25%)",
        }}
      >
        <Icon className="h-3 w-3" />
        {children}
      </a>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[10px] font-mono uppercase tracking-[0.16em] border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)] transition-colors"
    >
      <Icon className="h-3 w-3" />
      {children}
    </a>
  );
}
