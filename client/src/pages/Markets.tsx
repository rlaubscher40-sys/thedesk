import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Building2,
  ExternalLink,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { MarketComparison } from "@/components/markets/MarketComparison";
import { MarketDiscovery } from "@/components/markets/MarketDiscovery";
import { AuctionClearance } from "@/components/markets/AuctionClearance";
import { MarketRentConditions } from "@/components/markets/MarketRentConditions";
import { LocalMarketData } from "@/components/markets/LocalMarketData";
import { ComparisonWatchlist } from "@/components/markets/ComparisonWatchlist";
import { ShareIntelligenceCardButton } from "@/components/ask/ShareIntelligenceCardButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { trackEvent } from "@/lib/analytics";
import { trpc } from "@/lib/trpc";

const WATCH_KEY = "thedesk:market-watchlist:v1";
const EXAMPLES = ["Sydney", "Brisbane", "Perth", "Adelaide", "Townsville"];

function readWatchlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(WATCH_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string").slice(0, 12)
      : [];
  } catch {
    return [];
  }
}

function writeWatchlist(markets: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WATCH_KEY, JSON.stringify(markets.slice(0, 12)));
}

function parseQuery(search: string): string {
  return new URLSearchParams(search).get("q")?.trim() ?? "";
}

function cleanSnippet(value: string | null | undefined, max = 220): string {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

export default function MarketsPage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const initial = parseQuery(search);
  const comparisonMode = new URLSearchParams(search).has("vs");
  const otherMarket = new URLSearchParams(search).get("vs") ?? "";
  const [input, setInput] = useState(initial);
  const [market, setMarket] = useState(initial);
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => setWatchlist(readWatchlist()), []);
  useEffect(() => {
    setInput(initial);
    setMarket(initial);
    ask.reset();
  }, [initial]);

  const searchQuery = trpc.search.all.useQuery(
    { query: market },
    { enabled: !comparisonMode && market.length >= 2, staleTime: 60_000 }
  );
  const metrics = trpc.metrics.list.useQuery(undefined, { staleTime: 5 * 60_000 });
  const ask = trpc.ask.answer.useMutation();

  const feedItems = useMemo(() => searchQuery.data?.feedItems ?? [], [searchQuery.data]);
  const editions = useMemo(() => searchQuery.data?.editions ?? [], [searchQuery.data]);
  const coverageCount = feedItems.length + editions.length;
  const latestMention = useMemo(() => {
    const dates = feedItems
      .map((item) => item.feedDate)
      .filter(Boolean)
      .sort()
      .reverse();
    return dates[0] ?? null;
  }, [feedItems]);
  const categories = useMemo(
    () => [...new Set(feedItems.map((item) => item.category).filter(Boolean))],
    [feedItems]
  );
  const backdrop = useMemo(() => {
    const preferred = ["PROPERTY", "MACRO", "DEMOGRAPHICS", "LABOUR"];
    return [...(metrics.data ?? [])]
      .sort((a, b) => {
        const ai = preferred.indexOf((a.groupKey ?? "").toUpperCase());
        const bi = preferred.indexOf((b.groupKey ?? "").toUpperCase());
        const ar = ai === -1 ? 99 : ai;
        const br = bi === -1 ? 99 : bi;
        if (ar !== br) return ar - br;
        return (a.displayOrder ?? 100) - (b.displayOrder ?? 100);
      })
      .slice(0, 4);
  }, [metrics.data]);

  const watched = market
    ? watchlist.some((item) => item.toLowerCase() === market.toLowerCase())
    : false;

  function submit(next?: string) {
    const value = (next ?? input).trim();
    if (value.length < 2) return;
    setInput(value);
    setMarket(value);
    ask.reset();
    const params = new URLSearchParams();
    params.set("q", value);
    navigate(`/markets?${params.toString()}`, { replace: true });
  }

  function toggleWatch() {
    if (!market) return;
    const exists = watchlist.some((item) => item.toLowerCase() === market.toLowerCase());
    const next = exists
      ? watchlist.filter((item) => item.toLowerCase() !== market.toLowerCase())
      : [market, ...watchlist.filter((item) => item.toLowerCase() !== market.toLowerCase())];
    setWatchlist(next);
    writeWatchlist(next);
    if (!exists) trackEvent("market_watch", "markets");
  }

  function buildBrief() {
    if (!market || ask.isPending) return;
    const params = new URLSearchParams(search);
    const state = /^(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)$/.test(params.get("state") ?? "") ? params.get("state") : "";
    const kind = /^(SA2|LGA|suburb|postcode)$/.test(params.get("areaKind") ?? "") ? params.get("areaKind") : /^\d{4}$/.test(market) ? "postcode" : "";
    ask.mutate({
      question: `Assess ${kind} ${market.slice(0, 64)} ${state}: price momentum, rents, supply, credit, population and risks. Use Desk evidence only; state gaps and what would change the call.`,
    });
  }

  const answer = ask.data?.status === "answered" ? ask.data : null;

  return (
    <div className="pb-10">
      <header className="rule-major pt-5">
        <p className="bs-label-accent">The Desk · Markets</p>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-8 lg:gap-12 mt-3 items-end">
          <div>
            <h1
              className="font-serif font-bold"
              style={{
                fontSize: "clamp(44px, 7vw, 86px)",
                lineHeight: 0.9,
                letterSpacing: "-0.045em",
              }}
            >
              {comparisonMode
                ? "Put two markets to the test."
                : "Read a market before the consensus does."}
            </h1>
            <p
              className="font-serif mt-5 max-w-[62ch] text-[var(--color-fg-muted)]"
              style={{ fontSize: "clamp(19px, 2vw, 25px)", lineHeight: 1.42 }}
            >
              {comparisonMode
                ? "Compare the forces behind two property markets. See where the evidence leans, where it is thin and what would change the call."
                : "Search any Australian city, region or suburb. The Desk pulls every mention from its reporting, then turns the evidence into a sourced market brief."}
            </p>
          </div>
          <div className="lg:pb-2">
            <p className="bs-label">Tracked on this device</p>
            <p className="font-serif text-4xl font-bold mt-2 tabular-nums">{watchlist.length}</p>
            <p className="text-sm text-[var(--color-fg-muted)] mt-1">Market watchlist</p>
          </div>
        </div>
      </header>

      <nav aria-label="Market view" className="flex gap-3 mt-8">
        <Link
          href={market ? `/markets?q=${encodeURIComponent(market)}` : "/markets"}
          className={`bs-btn ${comparisonMode ? "bs-btn-outline" : "bs-btn-solid"}`}
        >
          Read a market
        </Link>
        <Link
          href={`/markets?q=${encodeURIComponent(market)}&vs=`}
          className={`bs-btn ${comparisonMode ? "bs-btn-solid" : "bs-btn-outline"}`}
        >
          Compare markets
        </Link>
      </nav>

      <ComparisonWatchlist />
      {!comparisonMode && <AuctionClearance metrics={metrics.data} loading={metrics.isLoading} />}
      {!comparisonMode && market && <MarketRentConditions marketA={market} />}
      {!comparisonMode && market && <LocalMarketData query={market} state={new URLSearchParams(search).get("state")} kind={new URLSearchParams(search).get("areaKind")} />}
      {comparisonMode ? (
        <MarketComparison
          marketA={initial}
          marketB={otherMarket}
          onCompare={(a, b) =>
            navigate(`/markets?q=${encodeURIComponent(a)}&vs=${encodeURIComponent(b)}`, {
              replace: true,
            })
          }
        />
      ) : (
        <>
          <section className="rule-major rule-hair-b mt-8">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
              className="flex items-center gap-4 py-5"
            >
              <MapPin className="h-5 w-5 shrink-0 text-[var(--color-accent-text)]" />
              <input
                maxLength={64}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Enter a market, city, region or suburb…"
                className="flex-1 min-w-0 bg-transparent border-0 outline-none font-serif"
                style={{
                  fontSize: "clamp(23px, 3vw, 36px)",
                  color: "var(--color-fg)",
                  caretColor: "var(--color-accent-text)",
                }}
                aria-label="Market name"
              />
              <button type="submit" className="bs-btn bs-btn-solid inline-flex items-center gap-2">
                <Search className="h-3.5 w-3.5" />
                Read market
              </button>
            </form>
          </section>

          <div className="flex flex-wrap gap-2 mt-3">
            {EXAMPLES.map((example) => (
              <button
                type="button"
                key={example}
                onClick={() => submit(example)}
                className="bs-label bs-link px-2.5 py-1.5 border border-[var(--color-border)]"
              >
                {example}
              </button>
            ))}
          </div>

          {watchlist.length > 0 && (
            <section className="mt-7 rule-hair rule-hair-b py-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="bs-label-accent mr-2">Watching</span>
                {watchlist.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => submit(item)}
                    className="bs-label bs-link"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </section>
          )}

          {!market && <MarketDiscovery />}

          {market && (
            <>
              <section className="grid sm:grid-cols-3 rule-major mt-9">
                <MarketStat
                  label="Desk references"
                  value={searchQuery.isLoading ? "…" : String(coverageCount)}
                />
                <MarketStat label="Latest mention" value={latestMention ?? "None yet"} border />
                <MarketStat
                  label="Signals touched"
                  value={categories.length ? String(categories.length) : "0"}
                  border
                />
              </section>

              <div className="flex flex-wrap items-center justify-between gap-4 rule-hair-b py-5">
                <div>
                  <p className="bs-label-accent">Market file</p>
                  <h2
                    className="font-serif font-bold mt-1.5"
                    style={{ fontSize: 38, lineHeight: 1 }}
                  >
                    {market}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={toggleWatch}
                    className="bs-btn bs-btn-outline inline-flex items-center gap-2"
                  >
                    {watched ? (
                      <BookmarkCheck className="h-3.5 w-3.5" />
                    ) : (
                      <Bookmark className="h-3.5 w-3.5" />
                    )}
                    {watched ? "Watching" : "Watch market"}
                  </button>
                  <button
                    type="button"
                    onClick={buildBrief}
                    disabled={ask.isPending || coverageCount === 0}
                    className="bs-btn bs-btn-solid inline-flex items-center gap-2 disabled:opacity-40"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {ask.isPending ? "Building brief" : "Build intelligence brief"}
                  </button>
                </div>
              </div>

              {searchQuery.isLoading ? (
                <MarketLoading />
              ) : coverageCount === 0 ? (
                <section className="py-12 rule-hair-b">
                  <p className="font-serif text-3xl">
                    The Desk has not built a file on {market} yet.
                  </p>
                  <p className="mt-3 max-w-[58ch] text-[var(--color-fg-muted)]">
                    That is useful information too. The brief stays evidence-led rather than
                    inventing a market view where the archive is thin.
                  </p>
                  <Link
                    href="/ask"
                    className="bs-btn bs-btn-outline mt-5 inline-flex items-center gap-2"
                  >
                    Ask a broader property question <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </section>
              ) : (
                <div className="grid lg:grid-cols-[minmax(0,1fr)_1px_340px]">
                  <section className="lg:pr-12 pt-8 min-w-0">
                    <p className="bs-label-accent">Evidence trail</p>
                    <h3
                      className="font-serif font-bold mt-2"
                      style={{ fontSize: 34, lineHeight: 1 }}
                    >
                      What The Desk has seen
                    </h3>
                    <div className="mt-5 rule-hair-b">
                      {feedItems.slice(0, 10).map((item) => (
                        <Link
                          key={item.id}
                          href={`/story/${item.id}`}
                          className="bs-row rule-hair block py-4"
                        >
                          <div className="flex flex-wrap items-center gap-2 bs-label">
                            <span className="text-[var(--color-accent-text)]">{item.category}</span>
                            <span>·</span>
                            <span>{item.feedDate}</span>
                            {item.source && (
                              <>
                                <span>·</span>
                                <span>{item.source}</span>
                              </>
                            )}
                          </div>
                          <p className="font-serif text-[22px] leading-7 mt-1.5">{item.title}</p>
                          <p className="mt-2 text-[15px] leading-6 text-[var(--color-fg-muted)]">
                            {cleanSnippet(item.snippet || item.summary)}
                          </p>
                        </Link>
                      ))}
                    </div>

                    {editions.length > 0 && (
                      <div className="mt-8">
                        <p className="bs-label">Weekly editions mentioning {market}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {editions.slice(0, 6).map((edition) => (
                            <Link
                              key={edition.id}
                              href={`/editions/${edition.editionNumber}`}
                              className="bs-btn bs-btn-outline"
                            >
                              Edition {edition.editionNumber}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>

                  <div className="hidden lg:block bg-[var(--color-border)]" aria-hidden="true" />

                  <aside className="lg:pl-9 pt-8 min-w-0">
                    <p className="bs-label-accent">National backdrop</p>
                    <div className="mt-4 rule-hair-b">
                      {backdrop.map((metric) => (
                        <div key={metric.metricKey} className="rule-hair py-3.5">
                          <p className="bs-label">{metric.label}</p>
                          <p className="font-serif font-bold text-3xl mt-1 tabular-nums">
                            {metric.value}
                            {metric.unit ?? ""}
                          </p>
                          {metric.context && (
                            <p className="text-xs leading-5 mt-1.5 text-[var(--color-fg-muted)]">
                              {metric.context}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    <Link
                      href="/signals"
                      className="bs-label bs-link mt-4 inline-flex items-center gap-1.5"
                    >
                      Open live signals <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </aside>
                </div>
              )}

              {ask.error && (
                <div className="rule-hair rule-hair-b py-5 mt-7 text-[var(--color-fg-muted)]">
                  {ask.error.message}
                </div>
              )}

              {ask.data?.status === "insufficient" && (
                <div className="rule-hair rule-hair-b py-5 mt-7 text-[var(--color-fg-muted)]">
                  {ask.data.message}
                </div>
              )}

              {answer && (
                <section className="rule-major mt-10 pt-7">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="bs-label-accent">The Desk Read</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="bs-label inline-flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-accent-text)]" />
                        {answer.answer.confidence} confidence · {answer.sources.length} sources
                      </span>
                      <ShareIntelligenceCardButton
                        shareToken={answer.shareToken}
                        headline={answer.answer.headline}
                      />
                    </div>
                  </div>
                  <h2
                    className="font-serif font-bold mt-4 max-w-[18ch]"
                    style={{
                      fontSize: "clamp(38px, 5vw, 62px)",
                      lineHeight: 0.98,
                      letterSpacing: "-0.035em",
                    }}
                  >
                    {answer.answer.headline}
                  </h2>
                  <p className="font-serif mt-6 max-w-[70ch] text-xl leading-8">
                    {answer.answer.answer}
                  </p>

                  {answer.answer.signals.length > 0 && (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 mt-8 rule-hair-b">
                      {answer.answer.signals.map((signal, index) => (
                        <div
                          key={`${signal.label}-${index}`}
                          className={`${index ? "sm:rule-hair-l sm:pl-5" : ""} py-4 sm:pr-5`}
                        >
                          <p className="bs-label">{signal.label}</p>
                          <p className="font-serif font-bold text-3xl mt-1">{signal.value}</p>
                          <p className="text-xs leading-5 mt-2 text-[var(--color-fg-muted)]">
                            {signal.context}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid lg:grid-cols-3 mt-8">
                    <BriefBlock label="Why it matters" text={answer.answer.whyItMatters} />
                    <BriefBlock label="The Desk Take" text={answer.answer.deskTake} border />
                    <BriefBlock
                      label="What changes the call"
                      text={answer.answer.whatWouldChangeOurMind}
                      border
                    />
                  </div>

                  <div className="mt-8">
                    <p className="bs-label">Sources used</p>
                    <div className="mt-3 rule-hair-b">
                      {answer.sources.map((source) => (
                        <div
                          key={source.ref}
                          className="rule-hair py-3 flex gap-4 justify-between items-start"
                        >
                          <Link href={source.href} className="bs-link font-serif text-lg leading-6">
                            {source.title}
                          </Link>
                          {source.externalUrl && (
                            <a
                              href={source.externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bs-label bs-link shrink-0"
                              aria-label={`Open source for ${source.title}`}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function MarketStat({
  label,
  value,
  border = false,
}: {
  label: string;
  value: string;
  border?: boolean;
}) {
  return (
    <div className={`${border ? "sm:rule-hair-l sm:pl-6" : ""} py-5 sm:pr-6`}>
      <p className="bs-label">{label}</p>
      <p className="font-serif font-bold mt-2 tabular-nums" style={{ fontSize: 32, lineHeight: 1 }}>
        {value}
      </p>
    </div>
  );
}

function BriefBlock({
  label,
  text,
  border = false,
}: {
  label: string;
  text: string;
  border?: boolean;
}) {
  return (
    <div className={`${border ? "lg:rule-hair-l lg:pl-7" : ""} py-5 lg:pr-7`}>
      <p className="bs-label-accent">{label}</p>
      <p className="font-serif text-lg leading-7 mt-3 text-[var(--color-fg-body)]">{text}</p>
    </div>
  );
}

function MarketEmptyState({ onSelect }: { onSelect: (value: string) => void }) {
  return (
    <section className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-10 rule-major mt-10 pt-7">
      <div>
        <p className="bs-label-accent">Market intelligence, not suburb profiles</p>
        <h2 className="font-serif font-bold mt-3" style={{ fontSize: 42, lineHeight: 1 }}>
          Start with a place. Follow the forces around it.
        </h2>
        <p className="font-serif text-xl leading-8 mt-4 max-w-[62ch] text-[var(--color-fg-muted)]">
          The Desk does not pretend to know a market from one growth figure. It builds the file from
          reporting on supply, credit, policy, migration and price signals, then shows you the
          evidence underneath the call.
        </p>
      </div>
      <div>
        <p className="bs-label">Popular starting points</p>
        <div className="mt-3 rule-hair-b">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onSelect(example)}
              className="bs-row rule-hair w-full py-3 flex items-center justify-between"
            >
              <span className="font-serif text-xl">{example}</span>
              <ArrowRight className="h-4 w-4 text-[var(--color-accent-text)]" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function MarketLoading() {
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-9 pt-8" aria-busy="true">
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-24 w-full rounded-none" />
        <Skeleton className="h-24 w-full rounded-none" />
        <Skeleton className="h-24 w-full rounded-none" />
      </div>
      <Skeleton className="h-64 rounded-none" />
    </div>
  );
}
