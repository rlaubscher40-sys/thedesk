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
    // The heading belongs to the calling section (the edition lead topic
    // sets it beside "What to watch"), so this renders the rows only.
    <div>
      <ul className="list-none m-0 p-0 flex flex-col gap-3.5">
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

  // Persona label / line / copy affordance on one baseline grid, active
  // persona at full ink and the rest muted — no panel, no borders.
  return (
    <li className="grid grid-cols-[118px_minmax(0,1fr)_24px] gap-3 items-baseline">
      <span
        className="font-mono uppercase truncate"
        style={{
          fontSize: 10,
          letterSpacing: "0.14em",
          color: highlighted ? "var(--color-accent-text)" : "var(--color-fg-muted)",
        }}
        title={personaDisplayLabel(partner)}
      >
        {personaDisplayLabel(partner)}
      </span>
      <span
        style={{
          fontSize: 15.5,
          lineHeight: 1.55,
          color: highlighted ? "var(--color-fg-body)" : "var(--color-fg-muted)",
        }}
      >
        &ldquo;{line}&rdquo;
      </span>
      <button
        onClick={handleCopy}
        aria-label={copied ? "Copied" : `Copy line for ${partner}`}
        className="bs-link justify-self-end text-[var(--color-fg-subtle)]"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </li>
  );
}
