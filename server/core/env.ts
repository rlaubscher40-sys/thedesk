/**
 * Single read of process.env wrapped so the rest of the server can import a
 * frozen, typed config object instead of touching env vars directly.
 *
 * Required in production:
 *   DATABASE_URL       — MySQL/TiDB connection string
 *   JWT_SECRET         — signs the admin session cookie
 *   ANTHROPIC_API_KEY  — LLM enrichment (partnerTag, sayThis, synthesis, etc.)
 *   ADMIN_PASSWORD     — gates the /admin console
 *
 * Optional:
 *   SCHEDULED_API_KEY  — auth header for the /api/ingest/* scheduler endpoints
 *   OPENAI_API_KEY     — enables AI image generation for the weekly hero;
 *                        omit to skip image generation entirely
 */
const requiredInProd = [
  "DATABASE_URL",
  "JWT_SECRET",
  "ANTHROPIC_API_KEY",
  "ADMIN_PASSWORD",
] as const;

if (process.env.NODE_ENV === "production") {
  for (const key of requiredInProd) {
    if (!process.env[key]) {
      console.warn(`[env] ${key} is not set — features that depend on it will fail`);
    }
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
});

export type Env = typeof env;
