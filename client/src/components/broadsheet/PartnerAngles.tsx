/**
 * The three partner angles, in two broadsheet arrangements.
 *
 * `<PartnerAngleRows>` is the vertical form used in the Today lead rail:
 * hairline-separated rows, active persona at full ink, the other two at
 * --color-fg-muted, active first.
 *
 * `<PartnerAngleColumns>` is the horizontal form used on the Story page:
 * three hairline-divided columns under a major rule.
 *
 * Both replace the collapsible PartnerTagBlock. The parsing
 * (`parsePartnerTag`), the persona state and `dedash()` are unchanged —
 * only the collapse is gone.
 */
import { parsePartnerTag, PARTNER_TAG_LABELS, type PartnerTagLabel } from "@shared/schemas";
import { cn } from "@/lib/cn";
import { dedash } from "@/lib/dedash";
import { PERSONA_COLOUR, personaDisplayLabel, usePersona } from "@/lib/persona";

/** Angles ordered with the reader's own role first. */
function useOrderedAngles(raw: string | null) {
  const { persona } = usePersona();
  const parsed = parsePartnerTag(raw);
  if (!parsed) return null;
  const active = persona as PartnerTagLabel;
  const ordered = [
    ...PARTNER_TAG_LABELS.filter((l) => l === active),
    ...PARTNER_TAG_LABELS.filter((l) => l !== active),
  ];
  return { parsed, ordered, active };
}

export function PartnerAngleRows({
  raw,
  heading = "How it lands for you",
}: {
  raw: string | null;
  heading?: string;
}) {
  const angles = useOrderedAngles(raw);
  if (!angles) return null;
  const { parsed, ordered, active } = angles;

  return (
    <div>
      <p className="bs-label" style={{ letterSpacing: "0.24em" }}>
        {heading}
      </p>
      <div className="mt-4">
        {ordered.map((label) => (
          <div key={label} className="rule-hair py-4">
            <p
              className="font-mono uppercase"
              style={{
                fontSize: 10,
                letterSpacing: "0.16em",
                color: PERSONA_COLOUR[label],
              }}
            >
              {personaDisplayLabel(label)}
            </p>
            <p
              className="mt-1.5"
              style={{
                fontSize: 16.5,
                lineHeight: 1.55,
                color:
                  label === active ? "var(--color-fg-body)" : "var(--color-fg-muted)",
              }}
            >
              {dedash(parsed[label])}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PartnerAngleColumns({
  raw,
  heading = "How it lands for each partner",
  className,
}: {
  raw: string | null;
  heading?: string;
  className?: string;
}) {
  const angles = useOrderedAngles(raw);
  if (!angles) return null;
  const { parsed, ordered, active } = angles;

  return (
    <section className={cn("rule-major pt-6", className)}>
      <p className="bs-label" style={{ letterSpacing: "0.24em" }}>
        {heading}
      </p>
      <div className="grid gap-y-6 sm:grid-cols-3 mt-5">
        {ordered.map((label, i) => (
          <div
            key={label}
            className={cn("min-w-0", i > 0 && "sm:rule-hair-l sm:pl-6", i < 2 && "sm:pr-6")}
          >
            <p
              className="font-mono uppercase"
              style={{ fontSize: 10, letterSpacing: "0.16em", color: PERSONA_COLOUR[label] }}
            >
              {personaDisplayLabel(label)}
            </p>
            <p
              className="mt-2"
              style={{
                fontSize: 16,
                lineHeight: 1.55,
                color: label === active ? "var(--color-fg-body)" : "var(--color-fg-muted)",
              }}
            >
              {dedash(parsed[label])}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
