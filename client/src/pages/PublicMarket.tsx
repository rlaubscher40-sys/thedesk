import { useState } from "react";
import { useParams } from "wouter";
import { PublicMarketRead } from "@shared/PublicMarketRead";
import { marketPath, publicMarket } from "@shared/marketDirectory";
import { SubscribeBand } from "@/components/broadsheet/SubscribeBand";
import { trpc } from "@/lib/trpc";
import { trackEvent } from "@/lib/analytics";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import NotFound from "./NotFound";

export default function PublicMarketPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const market = publicMarket(slug);
  useDocumentTitle(market ? `${market.name} property intelligence` : "Market not found");
  const query = trpc.markets.publicFile.useQuery(
    { slug },
    { enabled: Boolean(market), staleTime: 60_000, retry: 1 }
  );
  const [shareMessage, setShareMessage] = useState("");
  if (!market) return <NotFound />;
  if (query.isLoading)
    return (
      <p role="status" className="font-serif text-2xl py-12">
        Opening {market.name}'s source trail…
      </p>
    );
  if (query.isError)
    return (
      <section className="py-10">
        <h1 className="font-serif text-3xl">The market file is temporarily unavailable.</h1>
        <p className="mt-3">This is a loading problem, not a lack of market evidence.</p>
        <button className="bs-btn bs-btn-outline mt-5" onClick={() => void query.refetch()}>
          Try again
        </button>
      </section>
    );
  if (!query.data) return null;
  async function share() {
    const url = new URL(marketPath(slug), window.location.origin).toString();
    try {
      if (navigator.share)
        await navigator.share({ title: `${market?.name} property intelligence | The Desk`, url });
      else {
        await navigator.clipboard.writeText(url);
        setShareMessage("Market link copied.");
      }
      trackEvent("market_file_share", "markets");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setShareMessage("Could not share automatically. Copy this page's address to share it.");
    }
  }
  return (
    <>
      <PublicMarketRead
        file={query.data.file}
        directory={query.data.directory}
        onAction={(action) =>
          trackEvent(
            action === "ask"
              ? "market_file_ask"
              : action === "compare"
                ? "market_file_compare"
                : "market_file_source",
            "markets"
          )
        }
      />
      <div className="rule-hair py-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void share()} className="bs-btn bs-btn-solid">
          Share {market.name}'s file
        </button>
        {!query.data.directory.demo && query.data.file.referenceCount > 0 && (
          <a
            href={`/og/markets/${slug}.png`}
            download={`thedesk-${slug}.png`}
            className="bs-btn bs-btn-outline"
            onClick={() => trackEvent("market_file_export", "markets")}
          >
            Download 4:5 market card
          </a>
        )}
        {shareMessage && (
          <p role="status" className="text-sm">
            {shareMessage}
          </p>
        )}
      </div>
      <SubscribeBand
        source="market-file"
        kicker="Keep the bigger picture · free daily email"
        headline="The forces moving property. In your inbox each morning."
        blurb="Get The Desk's daily Australian briefing. This is the national email—not an alert service for this market. Confirm your email to subscribe; unsubscribe any time."
        showHeadshot={false}
      />
    </>
  );
}
