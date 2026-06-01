/**
 * Renders the talkingPoints map (partner type -> line) on a topic. Each line
 * has a copy button that writes to the clipboard.
 *
 * The reader's active persona (from PersonaSwitcher / localStorage) is
 * surfaced first and visually highlighted, the others sit below at reduced
 * opacity. Matches the daily-feed PartnerAngles behaviour so the persona
 * choice is honoured across the whole product.
 */
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import type { TalkingPoints } from "@shared/schemas";
import { personaDisplayLabel, usePersona } from "@/lib/persona";

/**
 * Loose string-match between an active persona ("Broker", "Adviser", etc.)
 * and an LLM-generated talkingPoints key ("Brokers", "Financial advisers",
 * etc.). Tolerates plural / "Financial " prefixes / case differences.
 */
function matchesPersona(activePersona: string, talkingKey: string): boolean {
  const a = activePersona.toLowerCase().replace(/s$/, "");
  const k = talkingKey.toLowerCase().replace(/s$/, "");
  if (a === k) return true;
  if (k.includes(a) || a.includes(k)) return true;
  // Common synonyms.
  if (a === "adviser" && k.includes("financial")) return true;
  if (a === "buyer agent" && k.includes("buyer")) return true;
  return false;
}

export function TalkingPointsBlock({ points }: { points: TalkingPoints }) {
  const { persona } = usePersona();
  const entries = Object.entries(points).filter(([, v]) => v && v.trim().length > 0);
  if (entries.length === 0) return null;

  // Sort so the active persona lands first.
  const sorted = [...entries].sort(([a], [b]) => {
    const aMatch = matchesPersona(persona, a) ? 0 : 1;
    const bMatch = matchesPersona(persona, b) ? 0 : 1;
    return aMatch - bMatch;
  });

  return (
    <div className="mt-5 pt-4 border-t border-[var(--color-border)]">
      <p className="overline mb-3">Talking points</p>
      <ul className="space-y-2.5">
        {sorted.map(([partner, line], idx) => (
          // partner key is defensive, duplicate keys in the source JSON would
          // otherwise trigger React key warnings (issue #1).
          <TalkingPointLine
            key={`${partner || "partner"}-${idx}`}
            partner={partner}
            line={line}
            highlighted={matchesPersona(persona, partner)}
          />
        ))}
      </ul>
    </div>
  );
}

function TalkingPointLine({
  partner,
  line,
  highlighted,
}: {
  partner: string;
  line: string;
  highlighted: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(line);
      setCopied(true);
      toast.success(`Copied for ${partner}`);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <li
      className="flex items-start gap-3 text-sm transition-opacity"
      style={highlighted ? undefined : { opacity: 0.55 }}
    >
      <span
        className="overline mt-1 w-28 shrink-0 truncate"
        style={highlighted ? { color: "var(--color-amber)" } : undefined}
      >
        {personaDisplayLabel(partner)}
      </span>
      <span
        className="flex-1 leading-relaxed"
        style={{
          color: highlighted ? "var(--color-fg)" : "var(--color-fg-muted)",
        }}
      >
        {line}
      </span>
      <button
        onClick={handleCopy}
        aria-label={copied ? "Copied" : `Copy line for ${partner}`}
        className="p-1 rounded text-[var(--color-fg-subtle)] hover:text-amber-300 shrink-0"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </li>
  );
}
