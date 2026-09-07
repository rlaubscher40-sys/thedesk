import { latestRent, rentGap } from "@shared/cityRents";
import { useState } from "react";
import {
  PublicComparisonRead,
  PUBLIC_COMPARISON_PATH,
  PUBLIC_COMPARISON_TITLE,
} from "@shared/PublicComparisonRead";
import { SubscribeBand } from "@/components/broadsheet/SubscribeBand";
import { trpc } from "@/lib/trpc";
import { trackEvent } from "@/lib/analytics";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

export default function PublicComparison() {
  useDocumentTitle(PUBLIC_COMPARISON_TITLE);
  const query = trpc.markets.rentalConditions.useQuery(undefined, { staleTime: 60_000, retry: 1 });
  const [message, setMessage] = useState("");
  async function share() {
    const url = new URL(PUBLIC_COMPARISON_PATH, window.location.origin).toString();
    try {
      if (navigator.share) await navigator.share({ title: PUBLIC_COMPARISON_TITLE, url });
      else {
        await navigator.clipboard.writeText(url);
        setMessage("Comparison link copied.");
      }
      trackEvent("public_comparison_share", "markets");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setMessage("Copy this page's address to share the comparison.");
    }
  }
  if (query.isLoading)
    return (
      <p role="status" className="font-serif text-2xl py-12">
        Opening the official rental comparison…
      </p>
    );
  return (
    <>
      <PublicComparisonRead
        data={query.data}
        asOf={new Date().toISOString().slice(0, 10)}
        onSource={() => trackEvent("public_comparison_source", "markets")}
      />
      {(query.isError || query.data?.status === "unavailable") && (
        <button
          type="button"
          className="bs-btn bs-btn-outline mb-5"
          onClick={() => void query.refetch()}
        >
          Retry rental data
        </button>
      )}
      <div className="rule-hair py-5">
        <button type="button" className="bs-btn bs-btn-solid" onClick={() => void share()}>
          Share Brisbane vs Perth
        </button>
        {rentGap(
          latestRent(query.data, "Brisbane"),
          latestRent(query.data, "Perth"),
          new Date().toISOString().slice(0, 10)
        ) !== null && (
          <a
            href="/og/markets/compare/brisbane-vs-perth.png"
            download="thedesk-brisbane-vs-perth.png"
            className="bs-btn bs-btn-outline inline-block mt-3 sm:mt-0 sm:ml-3"
          >
            Download comparison card
          </a>
        )}
        <p className="text-xs text-[var(--color-fg-muted)] mt-3">
          The link opens the latest available observations. It is not a saved snapshot.
        </p>
        {message && (
          <p role="status" className="text-sm mt-3">
            {message}
          </p>
        )}
      </div>
      <SubscribeBand
        source="market-comparison"
        kicker="The bigger picture · free daily email"
        headline="Keep up with the forces moving property."
        blurb="Get The Desk's daily Australian briefing. This is the national email, not a Brisbane–Perth alert service. Confirm your email to subscribe; unsubscribe any time."
        showHeadshot={false}
      />
    </>
  );
}
