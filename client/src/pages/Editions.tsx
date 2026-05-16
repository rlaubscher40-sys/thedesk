/**
 * Editions page.
 *
 * Editorial flow, top-to-bottom:
 *   1. PageHeader — title, kicker, Backfill button (admin)
 *   2. Horizontal EditionSelector — every edition as a card row
 *   3. EditionReader — full-width reader for the selected edition
 *
 * Previously the editions list was a sticky-left-rail and the reader sat
 * in the right column. On wide viewports the rail wasted ~25% of the
 * horizontal real estate. Promoting the list to a horizontal row at the
 * top frees the reader to occupy the full width.
 */
import { useEffect, useMemo } from "react";
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
            `Weekly intelligence for property partnerships — Edition ${edition.editionNumber}.`,
          ogTitle:
            edition.socialTitle ??
            edition.metaTitle ??
            `Edition ${edition.editionNumber} · ${edition.weekRange}`,
          ogDescription:
            edition.socialDescription ??
            edition.metaDescription ??
            edition.rubensTake ??
            undefined,
          ogImage: edition.heroImageUrl,
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
        actions={user?.role === "admin" ? <BackfillRubensTakeButton /> : undefined}
      />

      {/* Horizontal selector row. */}
      <SectionErrorBoundary section="Editions selector">
        {listQuery.isLoading ? (
          <SelectorSkeleton />
        ) : listQuery.data && listQuery.data.length > 0 ? (
          <EditionSelector
            editions={listQuery.data}
            activeNumber={selectedNumber}
          />
        ) : (
          <p className="text-sm text-[var(--color-fg-muted)]">
            No editions published yet.
          </p>
        )}
      </SectionErrorBoundary>

      {/* Full-width reader. */}
      <div className="mt-12">
        <SectionErrorBoundary section="Edition reader">
          {editionQuery.isLoading ? (
            <EditionReaderSkeleton />
          ) : editionQuery.data ? (
            <EditionReader edition={editionQuery.data} priorMetrics={priorMetrics} />
          ) : (
            <p className="text-sm text-[var(--color-fg-muted)]">
              Select an edition to begin reading.
            </p>
          )}
        </SectionErrorBoundary>
      </div>
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
