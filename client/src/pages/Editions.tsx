/**
 * Editions page.
 *
 * Editorial flow, top-to-bottom:
 *   1. PageHeader, title, kicker, Backfill button (admin)
 *   2. Horizontal EditionSelector, every edition as a card row
 *   3. EditionReader, full-width reader for the selected edition
 *
 * Previously the editions list was a sticky-left-rail and the reader sat
 * in the right column. On wide viewports the rail wasted ~25% of the
 * horizontal real estate. Promoting the list to a horizontal row at the
 * top frees the reader to occupy the full width.
 */
import { useEffect, useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { PageHeader } from "@/components/PageHeader";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { BackfillRubensTakeButton } from "@/components/editions/EditionAdminPanel";
import { EditionReader } from "@/components/editions/EditionReader";
import { EditionReaderSkeleton } from "@/components/editions/EditionReaderSkeleton";
import { EditionSelector } from "@/components/editions/EditionSelector";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/useAuth";
import { useEditionMeta } from "@/lib/useEditionMeta";
import { getNextEditionLabel } from "@/lib/date";
import { trpc } from "@/lib/trpc";

export default function EditionsPage() {
  const params = useParams<{ editionNumber?: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const listQuery = trpc.editions.list.useQuery();

  const selectedNumber = useMemo(() => {
    if (params.editionNumber) {
      const n = parseInt(params.editionNumber, 10);
      return Number.isFinite(n) ? n : null;
    }
    return listQuery.data?.[0]?.editionNumber ?? null;
  }, [params.editionNumber, listQuery.data]);

  useEffect(() => {
    if (!params.editionNumber && listQuery.data?.[0]) {
      navigate(`/editions/${listQuery.data[0].editionNumber}`, { replace: true });
    }
  }, [params.editionNumber, listQuery.data, navigate]);

  const editionQuery = trpc.editions.getByNumber.useQuery(
    { editionNumber: selectedNumber ?? 0 },
    { enabled: selectedNumber != null }
  );

  // Prior edition for trend arrows on the metrics strip. Looked up from
  // the list query (already cached) so we don't fire a second round-trip.
  const priorMetrics = useMemo(() => {
    if (selectedNumber == null) return null;
    const prior = listQuery.data?.find(
      (ed) => ed.editionNumber === selectedNumber - 1
    );
    return prior?.keyMetrics ?? null;
  }, [listQuery.data, selectedNumber]);

  // Pump per-edition meta tags into <head> so a share to LinkedIn / Slack
  // gets the right preview card. Static index.html tags still serve as
  // the Google-crawler fallback.
  const edition = editionQuery.data;
  useEditionMeta(
    edition
      ? {
          title:
            edition.metaTitle ??
            `Edition ${edition.editionNumber} · ${edition.weekRange}`,
          description:
            edition.metaDescription ??
            edition.rubensTake ??
            `Weekly intelligence for property partnerships, Edition ${edition.editionNumber}.`,
          ogTitle:
            edition.socialTitle ??
            edition.metaTitle ??
            `Edition ${edition.editionNumber} · ${edition.weekRange}`,
          ogDescription:
            edition.socialDescription ??
            edition.metaDescription ??
            edition.rubensTake ??
            undefined,
          // Branded per-edition card (server-rendered) rather than the
          // hero illustration so share previews carry the masthead.
          ogImage: `/og/editions/${edition.editionNumber}.png`,
          url:
            typeof window !== "undefined"
              ? `${window.location.origin}/editions/${edition.editionNumber}`
              : undefined,
        }
      : null
  );

  return (
    <div>
      <PageHeader
        overline="The Desk · Editions"
        title="Weekly deep dives"
        kicker="Editorial intelligence for partner conversations. New edition each Sunday."
        actions={
          <div className="flex items-end gap-4">
            <EditionsMetaPanel editions={listQuery.data ?? []} />
            {user?.role === "admin" && <BackfillRubensTakeButton />}
          </div>
        }
      />

      {/* Horizontal selector row. Empty + loading states handled by the
          reader block below so the chrome doesn't double-render an empty
          message, see the EmptyEditions component. */}
      <SectionErrorBoundary section="Editions selector">
        {listQuery.isLoading ? (
          <SelectorSkeleton />
        ) : listQuery.data && listQuery.data.length > 0 ? (
          <EditionSelector
            editions={listQuery.data}
            activeNumber={selectedNumber}
          />
        ) : null}
      </SectionErrorBoundary>

      {/* Full-width reader. */}
      <div className="mt-12">
        <SectionErrorBoundary section="Edition reader">
          {listQuery.isLoading || editionQuery.isLoading ? (
            <EditionReaderSkeleton />
          ) : editionQuery.data ? (
            <EditionReader edition={editionQuery.data} priorMetrics={priorMetrics} />
          ) : (
            <EmptyEditions />
          )}
        </SectionErrorBoundary>
      </div>
    </div>
  );
}

/**
 * Real empty state for the editions page, what a partner-tester sees
 * when no editions have shipped yet. Previously this rendered a flat
 * "Select an edition to begin reading" string which read as broken.
 */
function EmptyEditions() {
  return (
    <div
      className="panel rounded p-10 sm:p-14 text-center max-w-[640px] mx-auto"
      style={{ background: "var(--grad-panel-soft)" }}
    >
      <div
        className="inline-flex items-center justify-center rounded-full mb-5"
        style={{
          width: 56,
          height: 56,
          background: "oklch(0.75 0.18 70 / 12%)",
          boxShadow: "inset 0 0 0 1px oklch(0.75 0.18 70 / 30%)",
        }}
      >
        <CalendarClock
          className="h-6 w-6 text-amber-300"
          strokeWidth={1.4}
        />
      </div>
      <p
        className="overline-amber mb-3"
        style={{ letterSpacing: "0.24em", fontSize: "10px" }}
      >
        Editions · Coming Sunday
      </p>
      <h2 className="font-serif text-2xl sm:text-3xl font-bold leading-tight mb-3">
        The first Weekly Edition lands soon.
      </h2>
      <p className="text-sm text-[var(--color-fg-muted)] leading-relaxed max-w-[44ch] mx-auto">
        Sundays 7am AEST. A long-form read on what shifted in Australian
        property partnerships that week, written for brokers, advisers,
        accountants and buyer&apos;s agents. The Daily Brief ships every
        weekday in the meantime.
      </p>
    </div>
  );
}

/**
 * Editorial meta panel for the Editions page header.
 *
 * Quiet block of mono-overline metadata that earns the right-side
 * whitespace next to the "Weekly deep dives" title. Three lines: when
 * the next edition lands, how many have shipped to date, and the
 * average read time. Falls back gracefully when there are no editions
 * yet, only the "next edition" row renders, so the panel still has
 * editorial weight without empty zeroes.
 */
function EditionsMetaPanel({
  editions,
}: {
  editions: Array<{ readingTime?: string | null }>;
}) {
  const nextEdition = getNextEditionLabel();
  const count = editions.length;
  const avgRead = useMemo(() => {
    if (!count) return null;
    const minutes = editions
      .map((e) => {
        const raw = e.readingTime?.match(/(\d+)/)?.[1];
        return raw ? parseInt(raw, 10) : null;
      })
      .filter((m): m is number => m !== null && m > 0);
    if (!minutes.length) return null;
    return Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length);
  }, [editions, count]);

  return (
    <div
      className="hidden md:block panel rounded-sm px-5 py-4 space-y-3.5 text-right shrink-0"
      style={{ minWidth: 200 }}
    >
      <MetaRow label="Next edition" value={`${nextEdition} · 07:00 AEST`} />
      {count > 0 && (
        <MetaRow
          label="Editions published"
          value={String(count).padStart(2, "0")}
        />
      )}
      {avgRead !== null && (
        <MetaRow label="Avg read time" value={`${avgRead} min`} />
      )}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p
        className="font-mono uppercase text-[var(--color-fg-subtle)]"
        style={{ fontSize: "10px", letterSpacing: "0.22em" }}
      >
        {label}
      </p>
      <p
        className="font-mono text-[var(--color-fg)] tabular-nums"
        style={{ fontSize: "12px", letterSpacing: "0.04em" }}
      >
        {value}
      </p>
    </div>
  );
}

function SelectorSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="shrink-0 panel rounded-sm overflow-hidden"
          style={{ width: 240 }}
        >
          <Skeleton className="w-full" style={{ aspectRatio: "16/5" }} />
          <div className="p-3.5 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
