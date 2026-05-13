/**
 * Editions page. Two-pane layout: left rail lists all editions (with draft
 * badges, improvement #8), right side is the EditionReader for the selected
 * one. /editions/:editionNumber selects a specific edition.
 */
import { useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { PageHeader } from "@/components/PageHeader";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { EditionListItem } from "@/components/editions/EditionListItem";
import { EditionReader } from "@/components/editions/EditionReader";
import { EditionReaderSkeleton } from "@/components/editions/EditionReaderSkeleton";
import { BackfillRubensTakeButton } from "@/components/editions/EditionAdminPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/useAuth";
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

  // Auto-navigate to newest edition once the list loads.
  useEffect(() => {
    if (!params.editionNumber && listQuery.data?.[0]) {
      navigate(`/editions/${listQuery.data[0].editionNumber}`, { replace: true });
    }
  }, [params.editionNumber, listQuery.data, navigate]);

  const editionQuery = trpc.editions.getByNumber.useQuery(
    { editionNumber: selectedNumber ?? 0 },
    { enabled: selectedNumber != null }
  );

  return (
    <div>
      <PageHeader
        overline="The Desk · Editions"
        title="Weekly deep dives"
        kicker="Editorial intelligence for partner conversations. New edition Sundays."
        actions={user?.role === "admin" ? <BackfillRubensTakeButton /> : undefined}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 lg:gap-8">
        <aside className="space-y-2">
          <SectionErrorBoundary section="Editions list">
            {listQuery.isLoading ? (
              <ListSkeleton />
            ) : listQuery.data && listQuery.data.length > 0 ? (
              listQuery.data.map((ed) => (
                <EditionListItem
                  key={ed.id}
                  editionNumber={ed.editionNumber}
                  weekRange={ed.weekRange}
                  publishedAt={ed.publishedAt}
                  readingTime={ed.readingTime}
                  heroImageUrl={ed.heroImageUrl}
                  hasDraft={ed.hasDraft}
                  active={ed.editionNumber === selectedNumber}
                />
              ))
            ) : (
              <p className="text-sm text-[var(--color-fg-muted)]">No editions published yet.</p>
            )}
          </SectionErrorBoundary>
        </aside>

        <div>
          <SectionErrorBoundary section="Edition reader">
            {editionQuery.isLoading ? (
              <EditionReaderSkeleton />
            ) : editionQuery.data ? (
              <EditionReader edition={editionQuery.data} />
            ) : (
              <p className="text-sm text-[var(--color-fg-muted)]">Select an edition to begin reading.</p>
            )}
          </SectionErrorBoundary>
        </div>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="panel p-4 rounded flex gap-3">
          <Skeleton className="h-16 w-16 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
