import { getQueryKey } from "@trpc/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { MARKET_BOOTSTRAP_ID, parseMarketBootstrap } from "@shared/marketBootstrap";
import { FEATURED_COMPARISON_PATH } from "@shared/featuredComparison";
import { trpc } from "./trpc";

export function seedMarketDocument(client: QueryClient, doc: Document, path: string): boolean {
  const element = doc.getElementById(MARKET_BOOTSTRAP_ID);
  const data = parseMarketBootstrap(element?.textContent ?? null, path);
  element?.remove();
  if (!data) return false;
  const options = { updatedAt: data.generatedAt };
  client.setQueryData(
    getQueryKey(trpc.markets.discovery, undefined, "query"),
    data.directory,
    options
  );
  if (path !== FEATURED_COMPARISON_PATH) {
    const slug = path.slice(9);
    const file = data.directory.markets.find((file) => file.market.slug === slug)!;
    client.setQueryData(
      getQueryKey(trpc.markets.publicFile, { slug }, "query"),
      { file, directory: data.directory },
      options
    );
  }
  return true;
}
