/**
 * Auth SDK. Signs/verifies session JWTs and resolves Express requests to a
 * database `User`. Calls the Manus OAuth backend to exchange codes and to look
 * up users that aren't yet in our database.
 */
import { AXIOS_TIMEOUT_MS, COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import { ForbiddenError } from "../../shared/errors";
import axios, { type AxiosInstance } from "axios";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import { getUserByOpenId, upsertUser } from "../db/users";
import type { User } from "../db/schema";
import { env } from "./env";

type ExchangeTokenResponse = {
  accessToken: string;
  refreshToken?: string;
};

type UserInfoResponse = {
  openId: string;
  name?: string;
  email?: string;
  platform?: string | null;
  platforms?: string[];
};

const EXCHANGE_TOKEN_PATH = "/webdev.v1.WebDevAuthPublicService/ExchangeToken";
const GET_USER_INFO_PATH = "/webdev.v1.WebDevAuthPublicService/GetUserInfo";
const GET_USER_INFO_WITH_JWT_PATH = "/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt";

function createHttpClient(): AxiosInstance {
  return axios.create({ baseURL: env.oAuthServerUrl, timeout: AXIOS_TIMEOUT_MS });
}

function deriveLoginMethod(platforms: unknown, fallback?: string | null): string | null {
  if (fallback) return fallback;
  if (!Array.isArray(platforms) || platforms.length === 0) return null;
  const set = new Set(platforms.filter((p): p is string => typeof p === "string"));
  if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
  if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
  if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
  if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE")) {
    return "microsoft";
  }
  if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
  const first = Array.from(set)[0];
  return first ? first.toLowerCase() : null;
}

function getSecret() {
  return new TextEncoder().encode(env.cookieSecret);
}

function decodeState(state: string): string {
  return atob(state);
}

class AuthSdk {
  private client = createHttpClient();

  async exchangeCodeForToken(code: string, state: string): Promise<ExchangeTokenResponse> {
    const { data } = await this.client.post<ExchangeTokenResponse>(EXCHANGE_TOKEN_PATH, {
      clientId: env.appId,
      grantType: "authorization_code",
      code,
      redirectUri: decodeState(state),
    });
    return data;
  }

  async getUserInfo(accessToken: string): Promise<UserInfoResponse> {
    const { data } = await this.client.post<UserInfoResponse>(GET_USER_INFO_PATH, { accessToken });
    return {
      ...data,
      platform: deriveLoginMethod((data as { platforms?: unknown }).platforms, data.platform ?? null),
    };
  }

  async getUserInfoWithJwt(jwtToken: string): Promise<UserInfoResponse> {
    const { data } = await this.client.post<UserInfoResponse>(GET_USER_INFO_WITH_JWT_PATH, {
      jwtToken,
      projectId: env.appId,
    });
    return {
      ...data,
      platform: deriveLoginMethod((data as { platforms?: unknown }).platforms, data.platform ?? null),
    };
  }

  async createSessionToken(openId: string, opts: { name?: string; expiresInMs?: number } = {}): Promise<string> {
    const expiresInMs = opts.expiresInMs ?? ONE_YEAR_MS;
    const expSeconds = Math.floor((Date.now() + expiresInMs) / 1000);
    return new SignJWT({ openId, appId: env.appId, name: opts.name ?? "" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expSeconds)
      .sign(getSecret());
  }

  async verifySession(token: string | undefined | null): Promise<{ openId: string; name: string } | null> {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
      const { openId, name } = payload as Record<string, unknown>;
      if (typeof openId !== "string" || typeof name !== "string") return null;
      return { openId, name };
    } catch {
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const sessionCookie = cookies[COOKIE_NAME];
    const session = await this.verifySession(sessionCookie);
    if (!session) throw ForbiddenError("Invalid session cookie");

    let user = await getUserByOpenId(session.openId);
    const signedInAt = new Date();

    if (!user) {
      // First time we see this openId — pull profile from OAuth backend.
      const info = await this.getUserInfoWithJwt(sessionCookie ?? "");
      await upsertUser({
        openId: info.openId,
        name: info.name ?? null,
        email: info.email ?? null,
        loginMethod: info.platform ?? null,
        lastSignedIn: signedInAt,
      });
      user = await getUserByOpenId(info.openId);
    } else {
      // Touch lastSignedIn so the admin panel can sort by recency.
      await upsertUser({ openId: user.openId, lastSignedIn: signedInAt });
    }

    if (!user) throw ForbiddenError("User not found");
    return user;
  }
}

export const sdk = new AuthSdk();
