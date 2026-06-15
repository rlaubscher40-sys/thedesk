/**
 * Sticky right rail for the Today page, shown on wide screens only (xl+).
 *
 * The page deliberately runs a single broadsheet column on laptops and below,
 * with the support cards banded across the foot. On a wide desktop that left
 * the right third empty, so this rail puts the ambient, glanceable tools there
 * — the role Perplexity's right column plays on Discover — without disturbing
 * the narrow-screen layout.
 *
 * Contents are all enriched-lane concepts or live-data widgets, so the rail
 * only renders when there's something worth showing:
 *   · Angle-for persona switcher (sticky, so it's reachable mid-scroll)
 *   · Today's talking points, with one-click copy
 *   · A compact market snapshot
 */
import { CheckCheck, Copy } from "lucide-react";
import type { DailyFeedItem } from "@shared/types";
import { cleanHeadline } from "@/lib/headline";
import { PersonaSwitcher } from "../PersonaSwitcher";
import { MarketsSnapshot } from "./MarketsSnapshot";
import { RailPanel } from "./RailPanel";

export function TodayRail({
  enriched,
  talkingPoints,
  copied,
  onCopy,
}: {
  enriched: boolean;
  talkingPoints: DailyFeedItem[];
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-6">
      {enriched && (
        <RailPanel overline="Angle for">
          <PersonaSwitcher />
        </RailPanel>
      )}

      {enriched && talkingPoints.length > 0 && (
        <RailPanel
          overline={`Talking points · ${talkingPoints.length}`}
          footer="Ready to drop into a client conversation"
        >
          <ol className="space-y-3 mb-5">
            {talkingPoints.slice(0, 5).map((item, i) => (
              <li key={item.id} className="flex gap-2.5">
                <span className="font-mono text-[11px] tabular-nums text-[var(--color-fg-subtle)] pt-0.5 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-[13px] font-serif leading-snug text-[var(--color-fg-muted)] line-clamp-2">
                  {cleanHeadline(item.title)}
                </p>
              </li>
            ))}
          </ol>
          <button
            onClick={onCopy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-sm px-3 py-2.5 text-[10px] font-mono uppercase tracking-[0.2em] transition-all active:scale-[0.98]"
            style={{
              background: copied ? "oklch(0.75 0.14 145 / 14%)" : "var(--grad-cta-amber)",
              color: copied ? "oklch(0.85 0.16 145)" : "var(--color-on-amber)",
              boxShadow: copied
                ? "inset 0 0 0 1px oklch(0.75 0.14 145 / 35%)"
                : "0 1px 0 oklch(1 0 0 / 18%) inset, 0 4px 14px oklch(0.75 0.18 70 / 25%)",
            }}
          >
            {copied ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied
              ? "Copied"
              : `Copy ${talkingPoints.length} talking point${talkingPoints.length === 1 ? "" : "s"}`}
          </button>
        </RailPanel>
      )}

      <MarketsSnapshot />
    </div>
  );
}
