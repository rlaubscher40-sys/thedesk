/**
 * Expanded view of a single feed item. Same content as the card, just laid
 * out to read.
 */
import { useState } from "react";
import { ArrowLeft, ExternalLink, Linkedin } from "lucide-react";
import { Link, useParams } from "wouter";
import { PageHeader } from "@/components/PageHeader";
import { SectionErrorBoundary } from "@/components/ErrorBoundary";
import { LinkedInPostModal } from "@/components/LinkedInPostModal";
import { SubscribeCallout } from "@/components/SubscribeCallout";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { PartnerTagBlock } from "@/components/feed/PartnerTagBlock";
import { SayThisLine } from "@/components/feed/SayThisLine";
import { WhyItMattersLine } from "@/components/feed/WhyItMattersLine";
import { categoryAccentClass } from "@/lib/category";
import { cleanHeadline, shouldShowSummary } from "@/lib/headline";
import { cn } from "@/lib/cn";
import { SITE_DISPLAY } from "@/lib/siteUrl";
import { trpc } from "@/lib/trpc";

export default function StoryPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "", 10);
  const [linkedInOpen, setLinkedInOpen] = useState(false);

  const itemQuery = trpc.feed.getById.useQuery(
    { id },
    { enabled: Number.isFinite(id) && id > 0 }
  );

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div>
        <PageHeader overline="Story" title="Invalid story id" />
        <BackLink />
      </div>
    );
  }

  return (
    <article className={cn("max-w-3xl mx-auto", itemQuery.data && categoryAccentClass(itemQuery.data.category))}>
      <BackLink />
      <SectionErrorBoundary section="Story">
        {itemQuery.isLoading ? (
          <StorySkeleton />
        ) : !itemQuery.data ? (
          <p className="text-sm text-[var(--color-fg-muted)] mt-6">Story not found.</p>
        ) : (
          <>
            <header className="mt-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="overline" style={{ color: "var(--color-amber)" }}>
                  {itemQuery.data.category}
                </span>
                <span className="overline">{itemQuery.data.source}</span>
                <span className="overline">{itemQuery.data.feedDate}</span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl leading-tight">{cleanHeadline(itemQuery.data.title)}</h1>
            </header>

            {shouldShowSummary(itemQuery.data.title, itemQuery.data.summary) && (
              <p className="text-base leading-relaxed mt-6 text-[var(--color-fg)]">
                {itemQuery.data.summary}
              </p>
            )}

            <div className="flex items-center gap-2 mt-5">
              {itemQuery.data.sourceUrl && (
                <a
                  href={itemQuery.data.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-[var(--color-fg-muted)] hover:text-amber-300"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Read original
                </a>
              )}
              <Button variant="outline" size="sm" onClick={() => setLinkedInOpen(true)}>
                <Linkedin className="h-3.5 w-3.5" /> Share to LinkedIn
              </Button>
            </div>

            {itemQuery.data.whyItMatters && (
              <WhyItMattersLine
                whyItMatters={itemQuery.data.whyItMatters}
                category={itemQuery.data.category}
              />
            )}
            {itemQuery.data.sayThis && (
              <SayThisLine sayThis={itemQuery.data.sayThis} category={itemQuery.data.category} />
            )}
            <PartnerTagBlock raw={itemQuery.data.partnerTag} />

            <LinkedInPostModal
              open={linkedInOpen}
              onOpenChange={setLinkedInOpen}
              initialText={[
                cleanHeadline(itemQuery.data.title),
                "",
                shouldShowSummary(itemQuery.data.title, itemQuery.data.summary)
                  ? itemQuery.data.summary
                  : "",
                itemQuery.data.sayThis ? `\nMy take: ${itemQuery.data.sayThis}` : "",
                "",
                `Via The Desk · ${SITE_DISPLAY}`,
              ]
                .join("\n")
                .trim()}
            />

            {/* End-of-read Subscribe panel. Compact variant, story pages
                are shorter reads than editions. */}
            <div className="mt-12">
              <SubscribeCallout source="story-foot" variant="story" />
            </div>
          </>
        )}
      </SectionErrorBoundary>
    </article>
  );
}

function BackLink() {
  return (
    <Link href="/" className="overline inline-flex items-center gap-1.5 hover:text-amber-300">
      <ArrowLeft className="h-3 w-3" /> Back to Today
    </Link>
  );
}

function StorySkeleton() {
  return (
    <div className="space-y-3 mt-6" aria-busy="true">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  );
}
