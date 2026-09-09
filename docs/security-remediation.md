# September 2026 security remediation

The security audit is addressed in one reviewable branch. Deploy only after the security and regression checks pass.

## Deployment behavior

- Existing admin cookies stop working when this release deploys. Sign in again; new sessions expire after 12 hours and are stored in `admin_sessions`.
- Logout revokes the stored session. Changing `ADMIN_PASSWORD`, `ADMIN_TOTP_SECRET` or `JWT_SECRET` invalidates existing admin sessions. The new session signing key is domain-separated from email/share signatures, so changing the password does not break those links.
- Session keys use PBKDF2-HMAC-SHA-256 with 600,000 iterations. Derivation is asynchronous and shared/cached for each server configuration, not repeated for each request. The password itself remains an environment secret in the existing single-admin architecture; this is not a hashed-password database migration.
- Production `JWT_SECRET` must contain at least 32 bytes. Generate a random value; length alone does not establish entropy. A signing-key change also invalidates existing email/share links.
- Schema catch-up creates `security_limits` and `admin_sessions`. Failure to access these tables denies the affected security-sensitive action; it never switches production to in-memory counters.
- After catch-up, startup checks the required security-table columns using `LIMIT 0`, retrieving no rows. Missing tables/columns or denied reads stop startup before the listening socket opens. This does not establish write or future migration permissions; those remain a separate production prerequisite.
- `railway.json` configures `/api/healthz` as the deployment health check with a 300-second timeout. Verify Railway applies it to the deployed revision. The check gates startup; it does not replace ongoing monitoring or the manual release checks below.
- Security counters and sessions are cleaned up hourly. Only expired counters are removed, with a one-day grace period; current-day exhaustion survives process restarts.
- Anonymous AI work defaults to 200 model attempts across the site per UTC day. Set `ANONYMOUS_AI_DAILY_ATTEMPTS` to a positive integer to adjust the cap. This bounds calls, not an exact currency charge. Keep a provider account spending limit as an independent control.
- Public email defaults: 15-minute resend cooldown, four sends per recipient/day, ten sends per client/day and 500 sends across the site/day. Counts include already-confirmed reminder emails. A limited request gets the same neutral response as a new signup. Failed deliveries still count towards the daily abuse caps.
- Browser mutations require a matching Origin when supplied, and reject cross-site Fetch Metadata. Header-key cron requests remain supported.
- The built HTML shell's inline scripts are authorized by exact SHA-256 CSP hashes. Arbitrary inline JavaScript is no longer allowed. The production build must be present before boot, as with the existing server.
- The trusted shell is parsed using an HTML5 parser, not a script-matching regular expression. Tests cover quoted attributes, spaced closing tags, inert templates/comments and browser-normalized line endings.
- Editorial draft fields and alternative headlines are omitted from public edition detail, search and category responses. Authenticated editors use `editions.editor`; Substack draft images require authentication and are marked private/no-store. If a CDN cached those images under the old public headers, purge those URLs when deploying.
- Shared public renders have a bounded result cache and allow at most two simultaneous uncached renders per process. Public crawler routes also have a per-client HTTP limit. Identical concurrent renders share one result.
- Public-read cache: at most 512 entries, 32 MiB of serialized key/value content and 32 distinct pending loaders. Oversized values are returned but not cached. Object/runtime overhead is additional to the serialized byte estimate.
- News article/RSS/Google News network requests reject non-public destinations and unexpected ports, revalidate every redirect, and validate DNS at the socket lookup. They retain TLS certificate checks and bound body/decompression bytes and deadlines.

## Enable two-factor authentication

MFA support is implemented, but enabling it requires the owner's authenticator enrollment. It is intentionally not silently enabled with a secret the owner has not enrolled.

1. Generate a random Base32 TOTP secret (at least 20 random bytes) using a trusted password manager or authenticator setup tool.
2. Enroll that same secret in the owner's authenticator using six digits, SHA-1 and 30-second steps.
3. Store it as the Railway `ADMIN_TOTP_SECRET` secret and redeploy. Never commit or paste it into an issue/PR.
4. Sign in with the password plus the current code. Codes cannot be replayed within the accepted window.
5. Keep recovery access to Railway separately protected with MFA. There is no insecure application bypass or public recovery endpoint.

Do not treat the MFA code path as proof MFA is active in production; verify after enrollment. Actual secret values, cloud access settings, production sessions and subscriber records were not inspected during implementation.

## Required repository and hosting settings

CI now checks dependency advisories, runs the test suite, and exercises real MySQL security-state concurrency using a throwaway local test database. Security workflows add secret scanning and CodeQL. The dependency overrides remove vulnerable nested packages as well as direct versions; the package manager and action revisions are pinned.

The CodeQL job also checks the generated SARIF results and fails on reported findings or a missing report. A successful upload alone is not a clean scan. This gate deliberately includes existing findings, not just newly introduced ones.

The initial strict scan surfaced 38 results, largely repeated scheduler/legacy aliases without route-level limits. Scheduler aliases now share 30 requests/client/minute, including authenticated social previews; uptime recording has a separate 30/minute limit and the identified public reads have 120/minute limits. Authentication remains mandatory where it was required. LinkedIn URLs now validate the parsed HTTPS hostname and reject credentials/ports; article and publisher text extraction use HTML parsing rather than script-removal/entity-decoding regexes.

On 8 September 2026, GitHub reported `main` unprotected, status-check enforcement off, and no repository rulesets. Ruben explicitly declined branch-protection changes and authorized a manually checked release. Leave those settings unchanged. Residual risk: other merges/direct pushes can bypass these checks; a manual check protects only the revision actually examined.

Railway production was inspected at deployed commit `669b1e4466de013711b8ab90f00024ff5c837a80`: its source is `main`, `checkSuites` is false, and no health check was configured. Therefore merging can trigger a deployment immediately. Do not merge this PR until the prerequisites below pass. Do not enable GitHub auto-merge under the assumption that workflows enforce a gate.

### Manual release gate

1. Verify the current main and PR head. Incorporate main, review the combined changes, and require successful `test`, `secrets`, and `codeql` jobs on the final integration revision. CI includes dependency audit, real isolated MySQL tests, TypeScript, the full test suite and production build; CodeQL must report zero findings. Recheck both refs immediately before a SHA-pinned merge. If either changed, repeat the affected review/checks.
2. In an authorized production runtime, verify `JWT_SECRET` is at least 32 bytes without printing it. For example: `node -e 'process.exit(Buffer.byteLength(process.env.JWT_SECRET || "") >= 32 ? 0 : 1)'`. A zero exit verifies length only, not entropy. Do not rotate it just to satisfy this check: rotation invalidates existing signed email/share links.
3. Have the database owner verify permission metadata for the runtime identity: CREATE/ALTER for catch-up and SELECT/INSERT/UPDATE/DELETE on `security_limits` and `admin_sessions`. Inspect grants/schema metadata only, not subscriber/session/counter rows. The connected Railway OAuth tools expose variable names but redact values; their container inspection cannot run the required secret-length or SQL permission check. Presence of a variable and successful boot of the old code are insufficient evidence.
4. Once these pass, merge the checked PR head and verify Railway's actual deployed commit, applied health-check setting, deployment status and application health. Record prepared, merged, deployed and verified separately. Existing admin cookies must be replaced by a new login.
5. Validate login/logout and draft privacy with an authorized synthetic/test session. Exercise email/AI budgets in isolated tests with mocked providers, never with real production emails or subscriber-data reads. Do not retry production probes previously blocked by automatic approval review.
6. Purge any previously cached Substack draft-image URLs through the CDN owner's supported access. Do not enumerate real drafts to discover these URLs. Without CDN access, record purge status as unverified. Keep MFA inactive until Ruben enrolls his authenticator.

Cloud MFA, runtime database least privilege, backups and restore capability remain separate unverified operational controls. Runtime CREATE/ALTER privileges remain necessary for the existing schema catch-up architecture; separate migration credentials in a future deployment change.

Public preview caching is mitigation, not a full DDoS service. Keep edge protections enabled. The application global AI cap is shared in the database; native rendering concurrency and HTTP limit stores remain per process.

## Dependency follow-up

The fresh 8 September audit detected [GHSA-82fw-gwwq-j7x9](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9) in Vitest and its mocker dependency. Vitest is upgraded to patched 4.1.11; the full suite must pass on the upgraded runner. The dependency gate now fails at low severity as well, so moderate advisories cannot leave a green security gate.

## Local verification

Use Node 22+ and the package manager declared in package.json. Run `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm audit:security` and `pnpm build`.

The MySQL integration test only runs with `SECURITY_TEST_DATABASE_URL` pointing to `127.0.0.1` or `localhost` and the database named `security_audit_test`. It refuses other database targets. CI provisions this database. It verifies concurrent reservations, multi-limit transaction rollback and session revocation using real SQL.

The scraper tests mock network transport and DNS to test public-address pinning, mixed DNS answers, private redirects, alternate IP encodings and byte limits without requesting private production infrastructure. No real emails are needed to test signup abuse controls.
