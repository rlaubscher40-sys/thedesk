import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { createPool, type Pool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
const testUrl = process.env.SECURITY_TEST_DATABASE_URL;
let pool: Pool;
let security: typeof import("./security");
beforeAll(async () => {
  if (!testUrl) return;
  const url = new URL(testUrl);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/security_audit_test")
    throw new Error("Security integration tests require the isolated local test database");
  pool = createPool(testUrl);
  await pool.query("DROP TABLE IF EXISTS security_limits");
  await pool.query("DROP TABLE IF EXISTS admin_sessions");
  vi.doMock("./client", () => ({ getDb: () => drizzle(pool) }));
  vi.doMock("../demo/store", () => ({ isDemoMode: () => false }));
  security = await import("./security");
  await expect(security.assertSecuritySchemaReady()).rejects.toThrow("Security schema unavailable");
  await pool.query(security.SECURITY_DDL[0].sql);
  await expect(security.assertSecuritySchemaReady()).rejects.toThrow("Security schema unavailable");
  await pool.query("DROP TABLE security_limits");
  for (const ddl of security.SECURITY_DDL) await pool.query(ddl.sql);
  await expect(security.assertSecuritySchemaReady()).resolves.toBeUndefined();
});
afterAll(async () => {
  await pool?.end();
});
it.skipIf(!testUrl)(
  "serializes concurrent budgets and persists session revocation in MySQL",
  async () => {
    const expiresMs = Date.now() + 60000;
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        security.chargeBudgets([{ key: "integration-shared", limit: 3, expiresMs }])
      )
    );
    expect(results.filter(Boolean)).toHaveLength(3);
    expect(await security.budgetUsed("integration-shared")).toBe(3);
    // A rejected multi-limit transaction cannot consume the other limit.
    expect(
      await security.chargeBudgets([
        { key: "integration-other", limit: 10, expiresMs },
        { key: "integration-shared", limit: 3, expiresMs },
      ])
    ).toBe(false);
    expect(await security.budgetUsed("integration-other")).toBe(0);
    await security.saveAdminSession("a".repeat(64), expiresMs);
    expect(await security.hasAdminSession("a".repeat(64))).toBe(true);
    await security.deleteAdminSession("a".repeat(64));
    expect(await security.hasAdminSession("a".repeat(64))).toBe(false);
    await security.refundBudget("integration-shared");
    expect(await security.chargeBudgets([{ key: "integration-shared", limit: 3, expiresMs }])).toBe(
      true
    );
  }
);

it.skipIf(!testUrl)("enforces draft privacy and revokes copied cookies through HTTP", async () => {
  // Only session/budget persistence uses MySQL. Editorial content and the admin
  // identity are synthetic; this test never opens a production database.
  const draft = "synthetic-private-draft";
  const asset = vi.fn(async () => ({ contentType: "image/png", bytes: Buffer.from(draft) }));
  vi.doMock("../db", () => ({
    getEditionById: async () => ({
      id: 1,
      editionNumber: 1,
      fullText: "public text",
      substackDraftBody: draft,
    }),
    getLatestEditionAsset: asset,
  }));
  vi.doMock("./users", () => ({
    getUserByOpenId: async () => ({ id: 1, openId: "admin", role: "admin" }),
    upsertUser: async () => undefined,
  }));
  vi.doMock("../core/env", () => ({
    env: {
      adminPassword: "isolated-http-test-password",
      cookieSecret: "isolated-http-test-signing-secret-at-least-32-bytes",
      adminTotpSecret: "",
    },
  }));
  const { default: express } = await import("express");
  const { createServer } = await import("node:http");
  const { createExpressMiddleware } = await import("@trpc/server/adapters/express");
  const { registerOAuthRoutes } = await import("../core/oauth");
  const { registerSeoRoutes } = await import("../core/seo");
  const { protectBrowserMutation } = await import("../core/csrf");
  const { createContext } = await import("../core/context");
  const { router } = await import("../core/trpc");
  const { editionsRouter } = await import("../routers/editions");
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json(), protectBrowserMutation);
  registerOAuthRoutes(app);
  registerSeoRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: router({ editions: editionsRouter }), createContext })
  );
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as import("node:net").AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;
  const headers = {
    "content-type": "application/json",
    "x-forwarded-proto": "https",
    origin: `https://127.0.0.1:${port}`,
  };
  const input = encodeURIComponent(JSON.stringify({ json: { editionId: 1 } }));
  const editorPath = `/api/trpc/editions.editor?input=${input}`;
  const imagePath = "/api/images/edition/1/substack";
  try {
    const publicResponse = await fetch(`${base}/api/trpc/editions.getById?input=${input}`);
    expect(publicResponse.status).toBe(200);
    const publicBody = await publicResponse.text();
    expect(publicBody).toContain("public text");
    expect(publicBody).not.toContain(draft);
    expect(publicBody).not.toContain("substackDraftBody");

    for (const path of [editorPath, imagePath]) {
      const response = await fetch(base + path);
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain(draft);
    }
    expect(asset).not.toHaveBeenCalled();

    const crossSite = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { ...headers, origin: "https://untrusted.invalid" },
      body: JSON.stringify({ password: "isolated-http-test-password" }),
    });
    expect(crossSite.status).toBe(403);
    expect(crossSite.headers.get("set-cookie")).toBeNull();
    await crossSite.text();
    const wrongPassword = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers,
      body: JSON.stringify({ password: "wrong" }),
    });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.headers.get("set-cookie")).toBeNull();
    await wrongPassword.text();

    const login = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers,
      body: JSON.stringify({ password: "isolated-http-test-password" }),
    });
    expect(login.status).toBe(200);
    expect(await login.json()).toEqual({ success: true });
    const setCookie = login.headers.get("set-cookie")!;
    for (const attribute of ["HttpOnly", "Secure", "SameSite=Lax", "Max-Age=43200"])
      expect(setCookie).toContain(attribute);
    const copiedCookie = setCookie.split(";")[0];
    for (const path of [editorPath, imagePath]) {
      const response = await fetch(base + path, { headers: { cookie: copiedCookie } });
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.text()).toContain(draft);
    }
    expect(asset).toHaveBeenCalledTimes(1);
    const logout = await fetch(`${base}/api/auth/logout`, {
      method: "POST",
      headers: { ...headers, cookie: copiedCookie },
    });
    expect(logout.status).toBe(200);
    expect(await logout.json()).toEqual({ success: true });
    expect(logout.headers.get("set-cookie")).toContain("Expires=Thu, 01 Jan 1970");
    for (const path of [editorPath, imagePath]) {
      const response = await fetch(base + path, { headers: { cookie: copiedCookie } });
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain(draft);
    }
    expect(asset).toHaveBeenCalledTimes(1);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});
