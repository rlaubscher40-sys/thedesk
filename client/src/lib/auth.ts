/**
 * Build the OAuth login URL using the current origin as the redirect target.
 *
 * Returns "#" when the OAuth env vars are missing (demo mode, fresh
 * Codespace, anyone running without `.env` configured). The render path that
 * uses this value will silently no-op rather than crashing — demo mode
 * auto-signs-in via the demo user, so the "Sign in" link should never need
 * to actually navigate anywhere in that case.
 */
export function getLoginUrl(): string {
  const portal = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  if (!portal || !appId) return "#";

  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);
  const url = new URL(`${portal.replace(/\/+$/, "")}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");
  return url.toString();
}

/**
 * True when OAuth env vars are configured. Use in render-time guards so the
 * Sign-in CTA only appears in deployments where it can actually work.
 */
export function hasOAuthConfig(): boolean {
  return Boolean(import.meta.env.VITE_OAUTH_PORTAL_URL && import.meta.env.VITE_APP_ID);
}
