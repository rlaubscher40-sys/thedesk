/** Read-only inventory. It does not grant rights or infer a publisher licence.
 * Run from the repository root: pnpm audit:legal > docs/legal/rights-register.json
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SOURCES, type Source } from "./ingest/sources";
import { EVIDENCE_SOURCES } from "./ingest/propertySources";
import { REEL_SHOTS } from "../server/video/reelVisualStandard";
import { assertReviewedPhotoBytes } from "../server/video/assetRights";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const policyReviews = JSON.parse(readFileSync("docs/legal/source-policy-reviews.json", "utf8")) as {
  policies: Array<{ id: string; host: string }>;
};
const sourceMap = new Map<string, Source>();
function add(source: Source) {
  sourceMap.set(source.url, source);
  source.recoveryRoutes?.forEach(add);
}
[...SOURCES, ...EVIDENCE_SOURCES].forEach(add);
const newsSources = [...sourceMap.values()].map((s) => ({
  name: s.name,
  discoveryUrl: s.url,
  channel: s.channel,
  policyReviewId:
    policyReviews.policies.find((p) => p.host === new URL(s.url).hostname)?.id ?? null,
  kind: new URL(s.url).hostname === "news.google.com" ? "discovery-only" : (s.kind ?? "rss"),
  permissionStatus: "not-assessed-by-this-inventory",
  licenceUrl: null,
  checkedAt: null,
  reviewer: null,
  requiredReview:
    "Check publisher terms for automated access, excerpts, AI processing, storage and commercial reuse. A working feed or robots permission is not a copyright licence. Google discovery does not license the underlying publisher.",
}));
const photographs = Object.entries(REEL_SHOTS).map(([key, shot]) => {
  assertReviewedPhotoBytes(shot, readFileSync(resolve("server/og/fonts", shot.asset)));
  return {
    key,
    ...shot,
    recordedEvidence:
      "Existing source records and docs/reel-archive-photography.md; documentary entries in shared/documentaryPhotos.ts",
    integrity: "hash-matched",
    legalClearance:
      "Recorded provenance, not a legal clearance opinion. Check context, endorsement, moral rights and any other applicable rights before a materially different use.",
  };
});
const dependencies = Object.entries({
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
}).map(([name, requestedVersion]) => {
  const installed = JSON.parse(readFileSync(resolve("node_modules", name, "package.json"), "utf8"));
  return {
    name,
    requestedVersion,
    installedVersion: installed.version,
    declaredLicence: installed.license ?? installed.licenses ?? null,
    scope: Object.hasOwn(packageJson.dependencies, name) ? "runtime" : "development",
    review:
      "Package metadata only; examine licence text, notices, bundled code and transitive dependencies before distribution.",
  };
});
console.log(
  JSON.stringify(
    {
      version: 1,
      generatedAt: new Date().toISOString(),
      scope:
        "Configured news discovery routes, bundled Reel photographs and direct npm dependencies. Not an exhaustive inventory of datasets, music, voices, fonts, generated assets, source article rights or transitive dependencies.",
      applicationLicence: {
        declared: packageJson.license,
        status:
          "Owner decision required. No licence changed; previous valid grants are not revoked.",
      },
      newsSources,
      photographs,
      dependencies,
    },
    null,
    2
  )
);
