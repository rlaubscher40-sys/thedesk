import { PROPERTY_REGIONS } from "../../shared/propertyCoverage";
import { SOURCES, type Source } from "./sources";

export type EvidenceSource = Source & { id: string; region: string; beat: string };
function news(query: string) {
  return `https://news.google.com/rss/search?${new URLSearchParams({ q: `${query} when:14d`, hl: "en-AU", gl: "AU", ceid: "AU:en" })}`;
}
const housing =
  '(housing OR "property market" OR rents OR "home prices" OR "building approvals" OR "real estate")';

/** Independent budgets for statewide, regional and government discovery in all 8 jurisdictions.
 * Google is a discovery service, never counted as an independent publisher. */
export const STATE_PROPERTY_SOURCES: EvidenceSource[] = PROPERTY_REGIONS.flatMap((region) =>
  [
    {
      id: `${region.code.toLowerCase()}-housing`,
      name: `${region.name} housing`,
      region: region.code,
      beat: "housing",
      query: `("${region.name}" OR ${region.code} OR "${region.places[0]}") ${housing}`,
    },
    {
      id: `${region.code.toLowerCase()}-regional`,
      name: `${region.name} regional housing`,
      region: region.code,
      beat: "regional",
      query: `("${region.name}" OR ${region.code}) (${region.places
        .slice(1)
        .map((place) => `"${place}"`)
        .join(" OR ")}) ${housing}`,
    },
    {
      id: `${region.code.toLowerCase()}-government`,
      name: `${region.name} government housing`,
      region: region.code,
      beat: "policy",
      query: `site:${region.domain} (housing OR planning OR "land tax" OR tenancy OR infrastructure)`,
    },
  ].map(({ query, ...source }) => ({
    ...source,
    url: news(query),
    category: "PROPERTY",
    channel: "PROPERTY",
    maxItems: 100,
  }))
);

export const EVIDENCE_SOURCES: EvidenceSource[] = [
  ...SOURCES.filter((source) => ["AU", "PROPERTY"].includes(source.channel)).map((source) => ({
    ...source,
    id: `national-${source.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    region: "AU",
    beat: source.category.toLowerCase(),
    maxItems: 100,
  })),
  ...STATE_PROPERTY_SOURCES,
];
