import { useState } from "react";
import { FeaturedComparisonRead } from "@shared/FeaturedComparisonRead";
import {
  featuredComparison,
  FEATURED_COMPARISON_PATH,
  FEATURED_COMPARISON_CARD,
} from "@shared/featuredComparison";
import { SubscribeBand } from "@/components/broadsheet/SubscribeBand";
import { trpc } from "@/lib/trpc";
import { trackEvent } from "@/lib/analytics";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

export default function FeaturedComparisonPage() {
  useDocumentTitle("Brisbane vs Perth: rental conditions");
  const query = trpc.markets.discovery.useQuery(undefined, { staleTime: 60_000, retry: 1 });
  const [message, setMessage] = useState("");
  if (query.isLoading)
    return (
      <p className="font-serif text-2xl py-10" role="status">
        Opening the Brisbane–Perth evidence…
      </p>
    );
  if (query.isError)
    return (
      <section className="py-10">
        <h1 className="font-serif text-3xl">The comparison is temporarily unavailable.</h1>
        <button className="bs-btn bs-btn-outline mt-4" onClick={() => void query.refetch()}>
          Try again
        </button>
      </section>
    );
  if (!query.data) return null;
  const read = featuredComparison(query.data);
  async function share() {
    const url = new URL(FEATURED_COMPARISON_PATH, window.location.origin).toString();
    try {
      if (navigator.share) await navigator.share({ title: "Brisbane vs Perth | The Desk", url });
      else {
        await navigator.clipboard.writeText(url);
        setMessage("Comparison link copied.");
      }
      trackEvent("market_compare_share", "markets");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setMessage("Copy this page's address to share the comparison.");
    }
  }
  return (
    <>
      <FeaturedComparisonRead
        directory={query.data}
        onSource={() => trackEvent("market_file_source", "markets")}
      />
      <div className="rule-hair py-5 flex flex-wrap gap-3 items-center">
        <button className="bs-btn bs-btn-solid" onClick={() => void share()}>
          Share Brisbane vs Perth
        </button>
        {read.gap !== null && (
          <a
            href={FEATURED_COMPARISON_CARD}
            download="thedesk-brisbane-vs-perth.png"
            className="bs-btn bs-btn-outline"
            onClick={() => trackEvent("market_file_export", "markets")}
          >
            Download 4:5 comparison card
          </a>
        )}
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </div>
      <SubscribeBand
        source="market-comparison"
        kicker="Follow the bigger picture · free daily email"
        headline="Know what changes next."
        blurb="Get the national Australian briefing each morning. This is not a Brisbane or Perth alert service. Confirm your email to subscribe; unsubscribe any time."
        showHeadshot={false}
      />
    </>
  );
}
