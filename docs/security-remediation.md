# September 2026 security remediation

The security audit is addressed in one reviewable branch. Deploy only after the security and regression checks pass.

## Deployment behavior

- Existing admin cookies stop working when this release deploys. Sign in again; new sessions expire after 12 hours and are stored in `admin_sessions`.
- Logout revokes the stored session. Changing `ADMIN_PASSWORD`, `ADMIN_TOTP_SECRET` or `JWT_SECRET` invalidates existing admin sessions. The new session signing key is domain-separated from email/share signatures, so changing the password does not break those links.
- Production `JWT_SECRET` must contain at least 32 bytes. Generate a random value; length alone does not establish entropy. A signing-key change also invalidates existing email/share links.
- Schema catch-up creates `security_limits` and `admin_sessions`. Failure to access these tables denies the affected security-sensitive action; it never switches production to in-memory counters.
- Security counters and sessions are cleaned up hourly. Only expired counters are removed, with a one-day grace period; current-day exhaustion survives process restarts.
- Anonymous AI work defaults to 200 model attempts across the site per UTC day. Set `ANONYMOUS_AI_DAILY_ATTEMPTS` to a positive integer to adjust the cap. This bounds calls, not an exact currency charge. Keep a provider account spending limit as an independent control.
- Public email defaults: 15-minute resend cooldown, four sends per recipient/day, ten sends per client/day and 500 sends across the site/day. Counts include already-confirmed reminder emails. A limited request gets the same neutral response as a new signup. Failed deliveries still count towards the daily abuse caps.
- Browser mutations require a matching Origin when supplied, and reject cross-site Fetch Metadata. Header-key cron requests remain supported.
- The built HTML shell's inline scripts are authorized by exact SHA-256 CSP hashes. Arbitrary inline JavaScript is no longer allowed. The production build must be present before boot, as with the existing server.
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

An owner must verify/enforce required CI, secret-scan and CodeQL checks on main, review requirements, deploy-after-checks settings, cloud MFA, runtime database least privilege, backups and a restore exercise. Repository-defined workflows alone cannot turn on those account controls. Runtime CREATE/ALTER privileges remain necessary for the existing schema catch-up architecture; separate migration credentials in a future deployment change.

Public preview caching is mitigation, not a full DDoS service. Keep edge protections enabled. The application global AI cap is shared in the database; native rendering concurrency and HTTP limit stores remain per process.

## Local verification

Use Node 22+ and the package manager declared in package.json. Run `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm audit:security` and `pnpm build`.

The MySQL integration test only runs with `SECURITY_TEST_DATABASE_URL` pointing to `127.0.0.1` or `localhost` and the database named `security_audit_test`. It refuses other database targets. CI provisions this database. It verifies concurrent reservations, multi-limit transaction rollback and session revocation using real SQL.

The scraper tests mock network transport and DNS to test public-address pinning, mixed DNS answers, private redirects, alternate IP encodings and byte limits without requesting private production infrastructure. No real emails are needed to test signup abuse controls.
