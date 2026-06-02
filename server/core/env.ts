/**
 * Single read of process.env wrapped so the rest of the server can import a
 * frozen, typed config object instead of touching env vars directly.
 *
 * Required in production:
 *   DATABASE_URL      , MySQL/TiDB connection string
 *   JWT_SECRET        , signs the admin session cookie
 *   ANTHROPIC_API_KEY , LLM enrichment (partnerTag, sayThis, synthesis, etc.)
 *   ADMIN_PASSWORD    , gates the /admin console
 *
 * Optional:
 *   SCHEDULED_API_KEY , auth header for the /api/ingest/* scheduler endpoints
 *   OPENAI_API_KEY    , enables AI image generation for the weekly hero;
 *                        omit to skip image generation entirely
 *   DB_POOL_SIZE      , max pooled MySQL connections (default 10). Keep
 *                        below the TiDB cluster's connection ceiling.
 */

/** Parse a positive-integer env var, falling back when unset or invalid. */
function intEnv(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
const requiredInProd = [
  "DATABASE_URL",
  "JWT_SECRET",
  "ANTHROPIC_API_KEY",
  "ADMIN_PASSWORD",
] as const;

if (process.env.NODE_ENV === "production") {
  const missing = requiredInProd.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    // Fail loud at boot rather than limping along. A production deploy
    // missing DATABASE_URL would otherwise fall through to demo mode (an
    // unauthenticated, wide-open admin UI); a missing JWT_SECRET or
    // ADMIN_PASSWORD silently breaks or disables login. Better to refuse
    // to start so the misconfig is caught at deploy time, not by a user.
    console.error(
      `[env] FATAL: required production env var(s) not set: ${missing.join(", ")}. ` +
        `Set them on the server and redeploy.`
    );
    process.exit(1);
  }
}

export const env = Object.freeze({
  isProduction: process.env.NODE_ENV === "production",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  scheduledApiKey: process.env.SCHEDULED_API_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN ?? "",
  instagramBusinessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID ?? "",
  dbPoolSize: intEnv(process.env.DB_POOL_SIZE, 10),
});

export type Env = typeof env;
