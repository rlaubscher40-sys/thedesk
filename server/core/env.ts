/**
 * Single read of process.env wrapped so the rest of the server can import a
 * frozen, typed config object instead of touching env vars directly.
 */
const requiredInProd = ["DATABASE_URL", "JWT_SECRET"] as const;

if (process.env.NODE_ENV === "production") {
  for (const key of requiredInProd) {
    if (!process.env[key]) {
      console.warn(`[env] ${key} is not set — features that depend on it will fail`);
    }
  }
}

export const env = Object.freeze({
  isProduction: process.env.NODE_ENV === "production",
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  scheduledApiKey: process.env.SCHEDULED_API_KEY ?? "",
});

export type Env = typeof env;
