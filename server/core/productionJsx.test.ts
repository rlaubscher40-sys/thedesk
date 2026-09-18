import { build } from "esbuild";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PUBLIC_MARKETS, type MarketDirectory } from "../../shared/marketDirectory";

it("renders market documents from the production JSX transform without a global React", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  const automatic = pkg.scripts.build.includes("--jsx=automatic");
  await mkdir("node_modules/.cache", { recursive: true });
  const outdir = await mkdtemp(path.resolve("node_modules/.cache/desk-ssr-"));
  try {
    await build({
      entryPoints: [
        "shared/PublicMarketRead.tsx",
        "shared/FeaturedComparisonRead.tsx",
        "shared/ProjectFollowThroughRead.tsx",
      ],
      outdir,
      outExtension: { ".js": ".mjs" },
      bundle: true,
      platform: "node",
      packages: "external",
      format: "esm",
      jsx: automatic ? "automatic" : "transform",
    });
    const directory: MarketDirectory = {
      asOf: "2026-09-13",
      since: "2026-06-16",
      demo: false,
      sampleLimit: 2000,
      sampleCapped: false,
      markets: PUBLIC_MARKETS.map((market) => ({
        market,
        asOf: "2026-09-13",
        since: "2026-06-16",
        referenceCount: 0,
        publisherCount: 0,
        latestMention: null,
        coverage: "none",
        indexable: false,
        references: [],
      })),
    };
    const { PublicMarketRead } = await import(
      pathToFileURL(path.join(outdir, "PublicMarketRead.mjs")).href
    );
    const { FeaturedComparisonRead } = await import(
      pathToFileURL(path.join(outdir, "FeaturedComparisonRead.mjs")).href
    );
    const { ProjectFollowThroughRead } = await import(
      pathToFileURL(path.join(outdir, "ProjectFollowThroughRead.mjs")).href
    );
    const file = directory.markets.find((item) => item.market.slug === "sydney")!;
    expect(renderToStaticMarkup(createElement(PublicMarketRead, { file, directory }))).toContain(
      "Sydney"
    );
    expect(renderToStaticMarkup(createElement(FeaturedComparisonRead, { directory }))).toContain(
      "Brisbane"
    );
    // The follow-through page is server-rendered with no data at all, so a
    // crawler and a reader without JavaScript still get the method and limits.
    const followThrough = renderToStaticMarkup(createElement(ProjectFollowThroughRead, {}));
    expect(followThrough).toContain("What happened after the application?");
    expect(followThrough).toContain("A determination is not an approval");
    expect(automatic).toBe(true);
  } finally {
    await rm(outdir, { recursive: true, force: true });
  }
});
