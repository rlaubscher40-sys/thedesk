/**
 * Author byline. Round headshot + name + role + LinkedIn / Substack
 * action chips. Sits next to Ruben's Take on the Edition reader.
 *
 * The headshot is loaded from /ruben.jpg. Save your real headshot to
 * client/public/ruben.jpg and it'll appear here automatically. The
 * component falls back to an "R" gradient initial if the image
 * doesn't load (404, no internet, etc.).
 */
import { useState } from "react";
import { Linkedin, Rss } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  /** Image URL — defaults to the file shipped in /public. */
  src?: string;
  /** Display name. */
  name?: string;
  /** Role line below the name. */
  role?: string;
  /** LinkedIn profile URL. */
  linkedin?: string;
  /** Substack publication URL. */
  substack?: string;
  /** Layout — "stacked" sits below the take, "inline" sits next to it. */
  variant?: "stacked" | "inline";
  className?: string;
};

export function AuthorByline({
  src = "/ruben.jpg",
  name = "Ruben Laubscher",
  role = "Head of Partnerships · InvestorKit",
  linkedin = "https://www.linkedin.com/in/ruben-laubscher/",
  substack = "https://thedeskglobal.substack.com",
  variant = "inline",
  className,
}: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const stacked = variant === "stacked";

  return (
    <div
      className={cn(
        "flex items-center gap-4",
        stacked && "flex-col items-start",
        className
      )}
    >
      {/* Headshot — circular, brand-coloured rim, falls back to a
          gradient "R" initial. */}
      <div className="relative shrink-0">
        <div
          className="rounded-full overflow-hidden relative"
          style={{
            width: 64,
            height: 64,
            boxShadow:
              "inset 0 0 0 1px oklch(1 0 0 / 12%), 0 4px 16px oklch(0 0 0 / 35%)",
          }}
        >
          {!imgFailed ? (
            <img
              src={src}
              alt={`${name} headshot`}
              className="w-full h-full object-cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center font-serif font-bold"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.32 0.06 260), oklch(0.16 0.04 260) 60%, oklch(0.32 0.18 70 / 50%))",
                fontSize: 28,
                color: "oklch(0.92 0.16 76)",
              }}
            >
              {name[0]?.toUpperCase()}
            </div>
          )}
        </div>
        {/* Amber rim ring. */}
        <span
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            boxShadow:
              "0 0 0 1px oklch(0.75 0.18 70 / 28%), 0 0 14px oklch(0.75 0.18 70 / 14%)",
          }}
          aria-hidden="true"
        />
      </div>

      {/* Name + role + actions. */}
      <div className="min-w-0">
        <p className="font-serif text-base font-semibold leading-tight">{name}</p>
        <p className="overline mt-1 truncate" style={{ letterSpacing: "0.16em" }}>
          {role}
        </p>
        <div className="flex items-center gap-2 mt-3">
          <ActionChip
            href={linkedin}
            label="LinkedIn"
            ariaLabel={`${name} on LinkedIn`}
            icon={Linkedin}
          />
          <ActionChip
            href={substack}
            label="Subscribe"
            ariaLabel={`Subscribe to ${name}'s Substack`}
            icon={Rss}
            primary
          />
        </div>
      </div>
    </div>
  );
}

function ActionChip({
  href,
  label,
  ariaLabel,
  icon: Icon,
  primary = false,
}: {
  href: string;
  label: string;
  ariaLabel: string;
  icon: typeof Linkedin;
  primary?: boolean;
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
        {label}
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
      {label}
    </a>
  );
}
