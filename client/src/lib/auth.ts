/**
 * Login URL for the admin. There's no OAuth provider, the admin signs in
 * by posting their password to /api/auth/login. The `getLoginUrl()` export
 * stays as a string for any legacy call sites; pointing at the dedicated
 * login route is enough.
 */
export function getLoginUrl(): string {
  return "/login";
}
