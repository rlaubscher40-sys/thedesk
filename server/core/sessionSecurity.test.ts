import { beforeEach, expect, it, vi } from "vitest";
import { COOKIE_NAME, SESSION_TTL_MS } from "../../shared/const";
const config = vi.hoisted(() => ({
  cookieSecret: "only-a-test-signing-key-with-at-least-32-bytes",
  adminPassword: "before",
  adminTotpSecret: "",
  isProduction: false,
  databaseUrl: "",
}));
vi.mock("./env", () => ({ env: config }));
import { sdk } from "./sdk";
import { resetDemoSecurityState } from "../db/security";
beforeEach(() => {
  config.adminPassword = "before";
  config.cookieSecret = "only-a-test-signing-key-with-at-least-32-bytes";
  config.adminTotpSecret = "";
  resetDemoSecurityState();
});
it("revokes a copied session on logout", async () => {
  const token = await sdk.createSessionToken();
  expect(await sdk.verifySession(token)).toMatchObject({ role: "admin" });
  await sdk.revokeSession({ headers: { cookie: `${COOKIE_NAME}=${token}` } } as any);
  expect(await sdk.verifySession(token)).toBeNull();
});
it("password rotation invalidates a previously signed session", async () => {
  const token = await sdk.createSessionToken();
  config.adminPassword = "after";
  expect(await sdk.verifySession(token)).toBeNull();
  expect(await sdk.verifySession(await sdk.createSessionToken())).not.toBeNull();
});
it("rejects expired and tampered tokens and bounds privileged lifetime", async () => {
  expect(SESSION_TTL_MS).toBe(12 * 60 * 60 * 1000);
  expect(await sdk.verifySession(await sdk.createSessionToken({ expiresInMs: -1000 }))).toBeNull();
  const token = await sdk.createSessionToken();
  expect(await sdk.verifySession("broken." + token)).toBeNull();
});

it.each(["cookieSecret", "adminTotpSecret"] as const)(
  "%s rotation invalidates signed sessions",
  async (field) => {
    const token = await sdk.createSessionToken();
    config[field] = "A".repeat(40);
    expect(await sdk.verifySession(token)).toBeNull();
    expect(await sdk.verifySession(await sdk.createSessionToken())).not.toBeNull();
  }
);

it("supports concurrent sessions using the same derived signing key", async () => {
  const tokens = await Promise.all(Array.from({ length: 4 }, () => sdk.createSessionToken()));
  expect(new Set(tokens).size).toBe(4);
  const sessions = await Promise.all(tokens.map((token) => sdk.verifySession(token)));
  expect(sessions.every((session) => session?.role === "admin")).toBe(true);
});
