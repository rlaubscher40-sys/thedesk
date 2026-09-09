import { afterEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import type { Express, Request, Response, NextFunction } from "express";
import { inlineScriptHashes, registerSecurityHeaders } from "./securityHeaders";
afterEach(() => vi.unstubAllEnvs());
it("allows local video previews without allowing blob scripts or external connections", () => {
  vi.stubEnv("NODE_ENV", "production");
  let middleware: (req: Request, res: Response, next: NextFunction) => void;
  const app = {
    use: (fn: typeof middleware) => {
      middleware = fn;
    },
  } as unknown as Express;
  registerSecurityHeaders(app);
  const headers = new Map<string, string>();
  middleware!(
    { headers: {}, secure: false } as Request,
    { setHeader: (k: string, v: string) => headers.set(k, v) } as unknown as Response,
    vi.fn()
  );
  const csp = headers.get("Content-Security-Policy")!;
  expect(csp).toContain("media-src 'self' blob:");
  expect(csp.split(";").find((part) => part.includes("script-src"))).not.toContain("unsafe-inline");
  expect(csp).toContain("connect-src 'self'");
  expect(csp).not.toContain("script-src 'self' blob:");
});

it("hashes only the exact trusted inline script content", () => {
  const a = inlineScriptHashes('<script>trusted()</script><script src="/assets/app.js"></script>');
  expect(a).toHaveLength(1);
  expect(a).not.toEqual(inlineScriptHashes("<script>changed()</script>"));
});

it.each([
  "<script>trusted()</script >",
  '<ScRiPt data-note="a > b">trusted()</ScRiPt\t>',
  '<script data-src="not-an-external-script">trusted()</script>',
])("handles browser-valid script markup: %s", (shell) => {
  const expected = `'sha256-${createHash("sha256").update("trusted()").digest("base64")}'`;
  expect(inlineScriptHashes(shell)).toEqual([expected]);
});

it("does not authorize scripts in comments, templates or external script elements", () => {
  expect(
    inlineScriptHashes(`
    <!-- <script>commentOnly()</script> -->
    <template><script>inertTemplate()</script></template>
    <script SRC="/app.js">externalFallback()</script>
    <script src>emptySourceAttribute()</script>
  `)
  ).toEqual([]);
});

it("hashes the browser's normalized line endings without decoding script entities", () => {
  const source = "const text = '&amp;';\nrun(text);";
  expect(inlineScriptHashes("<script>const text = '&amp;';\r\nrun(text);</script>")).toEqual([
    `'sha256-${createHash("sha256").update(source).digest("base64")}'`,
  ]);
});
