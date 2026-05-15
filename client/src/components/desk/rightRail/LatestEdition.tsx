/**
 * Latest Edition rail card. Edition number + week range + three category
 * chips representing the dominant topics in the edition.
 */
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { editionMeta, topics } from "@/data/editions/2026-05-15";
import { categoryColour } from "@/lib/category";
import { RailPanel } from "./RailPanel";

export function LatestEdition() {
  const topThree = topics.slice(0, 3);

  return (
    <RailPanel overline="Latest edition">
      <Link href={`/editions/${editionMeta.number}`} className="group block">
        <p
          className="font-serif text-2xl font-bold tabular-nums leading-none group-hover:text-amber-200 transition-colors"
        >
          Edition {editionMeta.number}
        </p>
        <p
          className="overline mt-2 mb-4 text-[var(--color-fg-muted)]"
          style={{ letterSpacing: "0.16em" }}
        >
          {editionMeta.weekRange}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {topThree.map((t) => (
            <span
              key={t.category}
              className="font-mono text-[9px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded border"
              style={{
                color: categoryColour(t.category),
                borderColor: `${categoryColour(t.category)}55`,
                background: `${categoryColour(t.category)}10`,
              }}
            >
              {t.label}
            </span>
          ))}
        </div>
        <span className="inline-flex items-center gap-1.5 overline-amber mt-4 group-hover:text-amber-200 transition-colors">
          Open edition
          <ArrowRight className="h-3 w-3" />
        </span>
      </Link>
    </RailPanel>
  );
}
