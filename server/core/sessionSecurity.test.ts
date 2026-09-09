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

it("requires the exact password, including Unicode, and accepts configuration rotation", async () => {
  config.adminPassword = "example-café🔑";
  expect(await sdk.verifyPassword(config.adminPassword)).toBe(true);
  expect(await sdk.verifyPassword("example-cafe🔑")).toBe(false);
  config.adminPassword = "replacement-test-password";
  expect(await sdk.verifyPassword("example-café🔑")).toBe(false);
  expect(await sdk.verifyPassword(config.adminPassword)).toBe(true);
});

it("does not accept missing or oversized input", async () => {
  expect(await sdk.verifyPassword("")).toBe(false);
  expect(await sdk.verifyPassword("x".repeat(4097))).toBe(false);
  config.adminPassword = "";
  expect(await sdk.verifyPassword("before")).toBe(false);
});

it("bounds concurrent password work and recovers capacity", async () => {
  const results = await Promise.all(Array.from({ length: 4 }, () => sdk.verifyPassword("before")));
  expect(results.filter((result) => result === true)).toHaveLength(2);
  expect(results.filter((result) => result === null)).toHaveLength(2);
  expect(await sdk.verifyPassword("before")).toBe(true);
});

it("refuses the previous password if configuration rotates during verification", async () => {
  const verification = sdk.verifyPassword("before");
  config.adminPassword = "after";
  expect(await verification).toBe(false);
});
