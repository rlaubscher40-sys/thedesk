import express from "express";
import { createHmac } from "node:crypto";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ unsubscribe: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../db", () => ({ unsubscribeByEmail: mock.unsubscribe }));
vi.mock("./env", () => ({ signingSecret: () => "isolated-unsubscribe-test-secret" }));
import { registerUnsubscribeRoute } from "./unsubscribeRoute";

let server: Server;
let origin: string;
beforeAll(async () => {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  registerUnsubscribeRoute(app);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw Error("Missing test port");
  origin = `http://127.0.0.1:${address.port}`;
});
beforeEach(() => vi.clearAllMocks());
afterAll(
  () =>
    new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    })
);

function params(exp?: string) {
  const email = "reader@example.test";
  const sig = createHmac("sha256", "isolated-unsubscribe-test-secret")
    .update(exp ? `${email}:${exp}` : email)
    .digest("base64url");
  return new URLSearchParams({ email, sig, ...(exp ? { exp } : {}) });
}

it("accepts valid browser, one-click POST and legacy links without authentication", async () => {
  const response = await fetch(
    `${origin}/api/unsubscribe?${params(String(Date.now() + 86400000))}`
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  const body = await response.text();
  expect(body).toContain("further newsletters");
  expect(body).not.toContain("reader@example.test");
  expect((await fetch(`${origin}/api/unsubscribe?${params()}`)).status).toBe(200);
  expect(
    (
      await fetch(`${origin}/api/unsubscribe?${params(String(Date.now() + 86400000))}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
      })
    ).status
  ).toBe(204);
  expect(mock.unsubscribe).toHaveBeenCalledTimes(3);
  expect(mock.unsubscribe).toHaveBeenCalledWith("reader@example.test");
});

it("rejects expired, tampered and multibyte signatures without a 500 or leaking signed links", async () => {
  const unicode = params();
  unicode.set("sig", "é".repeat(43));
  const tampered = params();
  tampered.set("email", "another@example.test");
  for (const query of [params(String(Date.now() - 1000)), unicode, tampered]) {
    const response = await fetch(`${origin}/api/unsubscribe?${query}`);
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(await response.text()).toContain(
      "mailto:ruben@thedesk.au?subject=Unsubscribe%20request"
    );
  }
  expect(mock.unsubscribe).not.toHaveBeenCalled();
});
