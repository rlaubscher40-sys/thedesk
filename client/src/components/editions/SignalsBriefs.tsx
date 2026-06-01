/**
 * Renders the `signals` array on an edition below the topic deck.
 * Editorial treatment: big mono numerals in amber, signal text in serif.
 *
 * The first six signals are shown as the "In brief" scan strip next to
 * Ruben's Take at the top of the hero, so this component skips them and
 * shows the rest as "More signals". If there are six or fewer signals
 * total, this section renders nothing to avoid duplication.
 *
 * Signals may carry a category (beat). When any do, the rail groups them
 * under beat subheads so the reader can scan by topic; editions whose
 * signals are bare strings (legacy) fall back to the flat numbered layout.
 */
import {
  signalCategory,
  signalText,
  type Signals,
} from "@shared/schemas";

const SHOWN_AT_TOP = 6;

export function SignalsBriefs({ signals }: { signals: Signals }) {
  const filtered = signals.filter((s) => signalText(s).trim().length > 0);
  // Drop the first six, they appear in the hero scan strip. If there's
  // nothing left after that, render nothing.
  const remaining = filtered.slice(SHOWN_AT_TOP);
  if (remaining.length === 0) return null;

  const grouped = remaining.some((s) => signalCategory(s));

  return (
    <section className="my-14">
      <div className="flex items-center gap-3 mb-6">
        <p className="overline-amber" style={{ letterSpacing: "0.2em" }}>
          More signals
        </p>
        <span
          className="block flex-1"
          style={{
            height: "1px",
            background:
              "linear-gradient(90deg, oklch(0.75 0.18 70 / 30%), transparent)",
          }}
          aria-hidden="true"
        />
      </div>
      {grouped ? (
        <GroupedSignals signals={remaining} />
      ) : (
        <FlatSignals signals={remaining} />
      )}
    </section>
  );
}

/** Legacy / uncategorised layout: a two-column numbered list. */
function FlatSignals({ signals }: { signals: Signals }) {
  return (
    <ol className="grid sm:grid-cols-2 gap-x-10 gap-y-5">
      {signals.map((signal, idx) => {
        const text = signalText(signal);
        return (
          <li
            key={`signal-${idx}-${text.slice(0, 24)}`}
            className="flex gap-5 items-baseline"
          >
            <span
              className="font-mono shrink-0 text-amber-400/80 tabular-nums"
              style={{ fontSize: "22px", fontWeight: 500 }}
            >
              {String(idx + 1 + SHOWN_AT_TOP).padStart(2, "0")}
            </span>
            <span className="font-serif text-lg text-[var(--color-fg)] leading-snug">
              {text}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Beat-grouped layout: a subhead per category in first-seen order. */
function GroupedSignals({ signals }: { signals: Signals }) {
  const order: string[] = [];
  const byBeat = new Map<string, string[]>();
  for (const s of signals) {
    const beat = (signalCategory(s) ?? "OTHER").toUpperCase();
    if (!byBeat.has(beat)) {
      byBeat.set(beat, []);
      order.push(beat);
    }
    byBeat.get(beat)!.push(signalText(s));
  }

  return (
    <div className="grid sm:grid-cols-2 gap-x-10 gap-y-8">
      {order.map((beat) => (
        <div key={beat}>
          <p
            className="overline mb-3 text-[var(--color-fg-subtle)]"
            style={{ letterSpacing: "0.2em" }}
          >
            {beat}
          </p>
          <ul className="space-y-3">
            {byBeat.get(beat)!.map((text, idx) => (
              <li
                key={`${beat}-${idx}-${text.slice(0, 24)}`}
                className="flex gap-3 items-baseline"
              >
                <span
                  className="shrink-0 text-amber-400/70 mt-0.5"
                  aria-hidden="true"
                >
                  ▸
                </span>
                <span className="font-serif text-[17px] text-[var(--color-fg)] leading-snug">
                  {text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
