/**
 * The Today lead.
 *
 * A `1.68fr / 1px / 1fr` grid. Left: kicker with corroboration, the 62px
 * headline, the dek, the 16:9 image and Why-it-matters / Counterpoint as a
 * hairline-divided two-up. Right: the three partner angles, then the
 * cash-rate panel.
 *
 * The Say This band that follows runs the full measure below the grid, so
 * it lives in the page rather than here.
 */
import { Link } from "wouter";
import type { DailyFeedItem } from "@shared/types";
import { cn } from "@/lib/cn";
import { useCategoryColour } from "@/lib/category";
import { cardDek } from "@/lib/cardDek";
import { cleanHeadline } from "@/lib/headline";
import { dedash } from "@/lib/dedash";
import { CashRatePanel } from "../MetricBlocks";
import { PartnerAngleRows } from "../PartnerAngles";
import { StoryImage } from "../StoryImage";
import { GUTTER_X } from "../tokens";

export function Lead({ item }: { item: DailyFeedItem }) {
  const dek = cardDek(item);

  const corroboration =
    item.corroborationCount && item.corroborationCount >= 2 && item.corroboratingSources?.length
      ? ` · corroborated by ${item.corroboratingSources.slice(0, 2).join(", ")}`
      : "";

  return (
    <div
      className={cn(
        GUTTER_X,
        "grid lg:grid-cols-[minmax(0,1.68fr)_1px_minmax(0,1fr)]"
      )}
    >
      <div className="pt-8 lg:pr-11 min-w-0">
        <p className="bs-label-accent" style={{ letterSpacing: "0.24em" }}>
          The lead · {item.category}
          {item.source ? ` · ${item.source}` : ""}
          {corroboration}
        </p>

        <Link href={`/story/${item.id}`} className="bs-link block mt-4">
          <h2
            className="font-serif font-bold"
            style={{
              fontSize: "clamp(34px, 4.4vw, 62px)",
              lineHeight: 0.97,
              letterSpacing: "-0.03em",
              textWrap: "pretty",
            }}
          >
            {cleanHeadline(item.title)}
          </h2>
        </Link>

        {dek && (
          <p
            className="font-serif mt-5"
            style={{
              fontSize: "clamp(18px, 1.7vw, 23px)",
              lineHeight: 1.42,
              color: "var(--color-fg-muted)",
              textWrap: "pretty",
            }}
          >
            {dek.text}
          </p>
        )}

        <StoryImage
          seed={item.id}
          category={item.category}
          alt=""
          className="mt-6"
          aspect="16 / 9"
          caption={item.source ? `Source: ${item.source}` : undefined}
        />

        {(item.whyItMatters || item.counterpoint) && (
          <div className="rule-hair mt-7 pt-6 flex flex-col sm:flex-row gap-6 sm:gap-7">
            {item.whyItMatters && dek?.from !== "whyItMatters" && (
              <div className="flex-1 min-w-0">
                <p className="bs-label">Why it matters</p>
                <p
                  className="mt-2"
                  style={{ fontSize: 17, lineHeight: 1.6, color: "var(--color-fg-body)" }}
                >
                  {dedash(item.whyItMatters)}
                </p>
              </div>
            )}
            {item.whyItMatters && item.counterpoint && (
              <div
                className="hidden sm:block w-px shrink-0"
                style={{ background: "var(--color-border)" }}
                aria-hidden="true"
              />
            )}
            {item.counterpoint && dek?.from !== "counterpoint" && (
              <div className="flex-1 min-w-0">
                <p className="bs-label">The counterpoint</p>
                <p
                  className="mt-2"
                  style={{ fontSize: 17, lineHeight: 1.6, color: "var(--color-fg-body)" }}
                >
                  {dedash(item.counterpoint)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Column hairline. Hidden below lg, where the grid is one column. */}
      <div
        className="hidden lg:block"
        style={{ background: "var(--color-border)" }}
        aria-hidden="true"
      />

      <div className="pt-8 lg:pl-11 min-w-0">
        <PartnerAngleRows raw={item.partnerTag} />
        <div className="rule-major mt-8 pt-6">
          <CashRatePanel />
        </div>
      </div>
    </div>
  );
}

/** Category dot used by the wire rows and elsewhere on the page. */
export function CategoryDot({ category }: { category: string }) {
  const colourFor = useCategoryColour();
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
      style={{ background: colourFor(category) }}
      aria-hidden="true"
    />
  );
}
