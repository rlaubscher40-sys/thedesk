/** Read-only inventory. It does not grant rights or infer a publisher licence.
 * Run from the repository root: pnpm audit:legal > docs/legal/rights-register.json
 */
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { sourceRightsHold } from "../shared/sourceRights";
import { resolve } from "node:path";
import { SOURCES, type Source } from "./ingest/sources";
import { EVIDENCE_SOURCES } from "./ingest/propertySources";
import { REEL_SHOTS } from "../server/video/reelVisualStandard";
import { assertReviewedPhotoBytes } from "../server/video/assetRights";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const webFontRegister = JSON.parse(readFileSync("docs/legal/web-fonts.json", "utf8")) as {
  fonts: Array<{ path: string; sha256: string; notice: string; noticeSha256: string }>;
};
for (const font of webFontRegister.fonts) {
  for (const [path, expected] of [
    [font.path, font.sha256],
    [font.notice, font.noticeSha256],
  ]) {
    const actual = createHash("sha256").update(readFileSync(path!)).digest("hex");
    if (actual !== expected) throw new Error(`Font or licence changed without review: ${path}`);
  }
}
for (const name of readdirSync("client/public/fonts").filter((name) =>
  /\.(woff2?|ttf|otf)$/i.test(name)
)) {
  if (!webFontRegister.fonts.some((font) => font.path === `client/public/fonts/${name}`))
    throw new Error(`Browser font missing from rights register: ${name}`);
}
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
  articleExtractionHold: sourceRightsHold(s.url),
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
const bundledAssets = readdirSync("server/og/fonts")
  .filter((name) => /\.(woff2?|ttf|otf|png|jpe?g|txt)$/i.test(name))
  .sort()
  .map((name) => {
    const path = `server/og/fonts/${name}`;
    const bytes = readFileSync(path);
    return {
      path,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      review: /\.license\.txt$|OFL-/.test(name)
        ? "Bundled notice; retain with distribution"
        : "Identity recorded; check the applicable font, image or other asset licence",
    };
  });
console.log(
  JSON.stringify(
    {
      version: 3,
      generatedAt: new Date().toISOString(),
      scope:
        "Configured news discovery routes and extraction holds, reviewed Reel photographs, browser font/notice integrity, bundled server font/image/notice file identities and direct npm dependencies. Dataset-specific terms, voice model components, historical exports and transitive dependency obligations still need assessment.",
      applicationLicence: {
        declared: packageJson.license,
        status:
          "Owner decision required. No licence changed; previous valid grants are not revoked.",
      },
      newsSources,
      photographs,
      webFonts: webFontRegister.fonts,
      dependencies,
      bundledAssets,
    },
    null,
    2
  )
);
