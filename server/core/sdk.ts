/**
 * Auth surface.
 *
 * The site has exactly one privileged user (Ruben). Public visitors are
 * anonymous and can read everything that's public. Admin operations are
 * gated by a single `ADMIN_PASSWORD` env var:
 *
 *   1. POST /api/auth/login with { password }, verified against
 *      env.adminPassword, sets a signed JWT cookie.
 *   2. Subsequent requests carry the cookie. `authenticateRequest()`
 *      verifies it and returns the synthetic admin user.
 *
 * No OAuth backend, no user table lookup, no per-user state. The single
 * admin identity is hard-coded; the database `users` table stays for
 * foreign keys on reading queue / notes / conversations but is only ever
 * populated with one row.
 */
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import { ForbiddenError } from "../../shared/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import { getUserByOpenId, upsertUser } from "../db/users";
import type { User } from "../db/schema";
import { env } from "./env";

const ADMIN_OPEN_ID = "admin";

function getSecret() {
  return new TextEncoder().encode(env.cookieSecret);
}

class AuthSdk {
  /** Verify the password the user typed against env.adminPassword. */
  verifyPassword(password: string): boolean {
    const expected = env.adminPassword;
    if (!expected) return false;
    if (password.length !== expected.length) return false;
    // Constant-time compare, protects against timing attacks even at this scale.
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) {
      mismatch |= expected.charCodeAt(i) ^ password.charCodeAt(i);
    }
    return mismatch === 0;
  }

  async createSessionToken(opts: { expiresInMs?: number } = {}): Promise<string> {
    const expiresInMs = opts.expiresInMs ?? ONE_YEAR_MS;
    const expSeconds = Math.floor((Date.now() + expiresInMs) / 1000);
    return new SignJWT({ openId: ADMIN_OPEN_ID, role: "admin" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expSeconds)
      .sign(getSecret());
  }

  async verifySession(
    token: string | undefined | null
  ): Promise<{ openId: string; role: "admin" } | null> {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
      const { openId, role } = payload as Record<string, unknown>;
      if (typeof openId !== "string" || role !== "admin") return null;
      return { openId, role: "admin" };
    } catch {
      return null;
    }
  }

  /**
   * Verify the cookie and return the admin user record. Lazily upserts
   * a row in the users table the first time the admin logs in so the
   * foreign keys on queue/notes/conversations have something to point at.
   */
  async authenticateRequest(req: Request): Promise<User> {
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const session = await this.verifySession(cookies[COOKIE_NAME]);
    if (!session) throw ForbiddenError("Invalid session cookie");

    let user = await getUserByOpenId(session.openId);
    const signedInAt = new Date();
    if (!user) {
      await upsertUser({
        openId: session.openId,
        name: "Ruben",
        email: null,
        loginMethod: "password",
        lastSignedIn: signedInAt,
      });
      user = await getUserByOpenId(session.openId);
    } else {
      await upsertUser({ openId: session.openId, lastSignedIn: signedInAt });
    }
    if (!user) throw ForbiddenError("Admin user record could not be created");
    // The single admin always has role admin regardless of what's in the DB.
    return { ...user, role: "admin" };
  }
}

export const sdk = new AuthSdk();
