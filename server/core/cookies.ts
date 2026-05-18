import type { CookieOptions, Request } from "express";

function isSecureRequest(req: Request): boolean {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const list = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return list.some((p) => p.trim().toLowerCase() === "https");
}

/**
 * Session cookie options. `sameSite: "lax"` is the right default for our
 * same-origin login flow, the cookie ships with top-level navigations
 * back to the site, but cross-site requests can't trigger authenticated
 * actions. (The old `"none"` was needed for the cross-origin OAuth
 * redirect that no longer exists.)
 */
export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "httpOnly" | "path" | "sameSite" | "secure"> {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(req),
  };
}
