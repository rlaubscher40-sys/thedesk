/**
 * Editions page.
 *
 * Editorial flow, top-to-bottom:
 *   1. Broadsheet title block with next-edition / published / avg-read
 *      figures, plus the Backfill button for admins
 *   2. Horizontal EditionSelector, every edition as a card row
 *   3. EditionReader, full-width reader for the selected edition
 *
 * The title block and selector are page chrome and carry their own
 * gutter; the reader below lays out gutter-to-gutter and owns its own.
 */
import { useEffect, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { BackfillRubensTakeButton } from "@/components/editions/EditionAdminPanel";
import { EditionReader } from "@/components/editions/EditionReader";
import { EditionReaderSkeleton } from "@/components/editions/EditionReaderSkeleton";
import { EditionSelector } from "@/components/editions/EditionSelector";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageTitle, type TitleStat } from "@/components/broadsheet/PageTitle";
import { GUTTER_X } from "@/components/broadsheet/tokens";
import { cn } from "@/lib/cn";
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
  const prior = useMemo(() => {
    if (selectedNumber == null) return null;
    return (
      listQuery.data?.find((ed) => ed.editionNumber === selectedNumber - 1) ??
      null
    );
  }, [listQuery.data, selectedNumber]);
  const priorMetrics = prior?.keyMetrics ?? null;
  const priorMarketStress = prior?.marketStress ?? null;

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
      {/* Header + selector are page chrome, so they carry the gutter
          themselves — the reader below lays out gutter-to-gutter and owns
          its own. */}
      <PageTitle
        kicker="The Desk · Editions"
        title="Weekly deep dives"
        standfirst="Editorial intelligence for partner conversations. New edition each Sunday."
        stats={editionStats(listQuery.data ?? [])}
        actions={user?.role === "admin" ? <BackfillRubensTakeButton /> : undefined}
      />

      <div className={cn(GUTTER_X, "rule-major mt-7 pt-6")}>
        {/* Horizontal selector row. Empty + loading states handled by the
            reader block below so the chrome doesn't double-render an empty
            message, see the EmptyEditions component. */}
        <SectionErrorBoundary section="Editions selector">
          {listQuery.isLoading ? (
            <SelectorSkeleton />
          ) : listQuery.data && listQuery.data.length > 0 ? (
            <EditionSelector editions={listQuery.data} activeNumber={selectedNumber} />
          ) : null}
        </SectionErrorBoundary>
      </div>

      <div className="mt-11">
        <SectionErrorBoundary section="Edition reader">
          {listQuery.isLoading || editionQuery.isLoading ? (
            <div className={GUTTER_X}>
              <EditionReaderSkeleton />
            </div>
          ) : editionQuery.data ? (
            <EditionReader
              edition={editionQuery.data}
              priorMetrics={priorMetrics}
              priorMarketStress={priorMarketStress}
            />
          ) : (
            <div className={GUTTER_X}>
              <EmptyEditions />
            </div>
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
    <div className="rule-hair rule-hair-b py-16 text-center">
      <p className="bs-label-accent" style={{ letterSpacing: "0.24em" }}>
        Editions · Coming Sunday
      </p>
      <h2
        className="font-serif font-bold mt-3"
        style={{ fontSize: 40, lineHeight: 1.04, letterSpacing: "-0.03em" }}
      >
        The first Weekly Edition lands soon.
      </h2>
      <p className="mx-auto mt-4 max-w-[52ch] text-[var(--color-fg-muted)]">
        Sundays 7am AEST. A long-form read on what shifted in Australian property
        partnerships that week, written for brokers, advisers, accountants and
        buyer&apos;s agents. The Daily Brief ships every weekday in the meantime.
      </p>
    </div>
  );
}

/**
 * Right-hand figures for the Editions title block: when the next edition
 * lands, how many have shipped, and the average read time. Rows that have
 * no data are omitted rather than rendered as empty zeroes.
 */
function editionStats(
  editions: Array<{ readingTime?: string | null }>
): TitleStat[] {
  const stats: TitleStat[] = [{ label: "Next edition", value: getNextEditionLabel() }];
  if (editions.length > 0) {
    stats.push({ label: "Published", value: String(editions.length) });
  }
  const minutes = editions
    .map((e) => {
      const raw = e.readingTime?.match(/(\d+)/)?.[1];
      return raw ? parseInt(raw, 10) : null;
    })
    .filter((m): m is number => m !== null && m > 0);
  if (minutes.length > 0) {
    const avg = Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length);
    stats.push({ label: "Avg read", value: `${avg} min` });
  }
  return stats;
}

function SelectorSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="shrink-0 overflow-hidden rule-hair-b"
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
