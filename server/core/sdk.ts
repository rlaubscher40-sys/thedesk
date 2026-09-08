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
 * No OAuth backend. Revocable sessions live in the database. The single
 * admin identity is hard-coded; the database `users` table stays for
 * foreign keys on reading queue / notes / conversations but is only ever
 * populated with one row.
 */
import { createHash, pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { COOKIE_NAME, SESSION_TTL_MS } from "../../shared/const";
import { ForbiddenError } from "../../shared/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import { getUserByOpenId, upsertUser } from "../db/users";
import type { User } from "../db/schema";
import { env } from "./env";
import { saveAdminSession, hasAdminSession, deleteAdminSession } from "../db/security";

const ADMIN_OPEN_ID = "admin";

let signingKey: { material: string; key: Promise<Buffer> } | undefined;
function getSecret(): Promise<Buffer> {
  const password = env.adminPassword;
  const salt = JSON.stringify([
    "the-desk-admin-session-v3",
    env.cookieSecret,
    env.adminTotpSecret ?? "",
  ]);
  const material = JSON.stringify([password, salt]);
  if (signingKey?.material === material) return signingKey.key;
  // Password-derived key: use a slow KDF, not a single fast hash/HMAC.
  // Derive once per configuration; concurrent requests share the work and
  // ordinary session checks never repeat the expensive derivation.
  const key = new Promise<Buffer>((resolve, reject) => {
    pbkdf2(password, salt, 600_000, 32, "sha256", (error, value) => {
      if (error) reject(error);
      else resolve(value);
    });
  });
  signingKey = { material, key };
  void key.catch(() => {
    if (signingKey?.key === key) signingKey = undefined;
  });
  return key;
}

class AuthSdk {
  /** Verify the password the user typed against env.adminPassword. */
  verifyPassword(password: string): boolean {
    const expected = env.adminPassword;
    if (!expected) return false;
    // Hash both sides to a fixed length, then compare in constant time.
    // Comparing the raw strings needed a length check first, and that
    // early return leaked the password's length through response timing.
    const a = createHash("sha256").update(password).digest();
    const b = createHash("sha256").update(expected).digest();
    return timingSafeEqual(a, b);
  }

  async createSessionToken(opts: { expiresInMs?: number } = {}): Promise<string> {
    const expiresInMs = opts.expiresInMs ?? SESSION_TTL_MS;
    const expSeconds = Math.floor((Date.now() + expiresInMs) / 1000);
    const sessionId = randomBytes(32).toString("hex");
    await saveAdminSession(sessionId, expSeconds * 1000);
    return new SignJWT({ openId: ADMIN_OPEN_ID, role: "admin" })
      .setJti(sessionId)
      .setIssuedAt()
      .setIssuer("the-desk")
      .setAudience("the-desk-admin")
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expSeconds)
      .sign(await getSecret());
  }

  async verifySession(
    token: string | undefined | null
  ): Promise<{ openId: string; role: "admin" } | null> {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, await getSecret(), {
        algorithms: ["HS256"],
        issuer: "the-desk",
        audience: "the-desk-admin",
      });
      const { openId, role } = payload as Record<string, unknown>;
      if (
        openId !== ADMIN_OPEN_ID ||
        role !== "admin" ||
        typeof payload.jti !== "string" ||
        !/^[a-f0-9]{64}$/.test(payload.jti)
      )
        return null;
      if (!(await hasAdminSession(payload.jti))) return null;
      return { openId, role: "admin" };
    } catch {
      return null;
    }
  }

  async revokeSession(req: Request): Promise<void> {
    const token = parseCookieHeader(req.headers.cookie ?? "")[COOKIE_NAME];
    if (!token) return;
    let id: string | undefined;
    try {
      const { payload } = await jwtVerify(token, await getSecret(), {
        algorithms: ["HS256"],
        issuer: "the-desk",
        audience: "the-desk-admin",
      });
      id = payload.jti;
    } catch {
      return;
    }
    if (id) await deleteAdminSession(id);
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
