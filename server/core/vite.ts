import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";
import type { Server } from "node:http";
import { createServer as createViteServer } from "vite";
import { isKnownRoute, isNoindexRoute, withNoindex } from "./spaShell";

export async function setupVite(app: Express, server: Server): Promise<void> {
  // Lazy import the config so production bundles don't pull in vite at runtime.
  const viteConfig = (await import("../../vite.config")).default;
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: { middlewareMode: true, hmr: { server }, allowedHosts: true as const },
    appType: "custom",
  });

  app.use(vite.middlewares);
  // Path-less catch-all (was app.use("*", ...)): Express 5's path-to-regexp v8
  // rejects the bare "*" string at boot. A use() with no path matches every
  // request just the same, and this stays last in the chain so it only fires
  // for requests nothing else handled.
  app.use(async (req, res, next) => {
    try {
      const clientHtml = path.resolve(import.meta.dirname, "../..", "client", "index.html");
      const template = await fs.promises.readFile(clientHtml, "utf-8");
      const page = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (err) {
      vite.ssrFixStacktrace(err as Error);
      next(err);
    }
  });
}

export function serveStatic(app: Express): void {
  const distPath = path.resolve(process.cwd(), "dist", "public");
  if (!fs.existsSync(distPath)) {
    console.error(`[static] missing build directory ${distPath}`);
  }
  // Hashed assets (JS/CSS chunks) are immutable — cache aggressively.
  // index.html must never be cached: a stale copy references old chunk
  // hashes that no longer exist after a deploy, causing browsers to receive
  // text/html back for a JS request → "not a valid JavaScript MIME type".
  app.use(
    express.static(distPath, {
      setHeaders(res, filePath) {
        if (path.basename(filePath) === "index.html") {
          res.setHeader("Cache-Control", "no-store");
        } else {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    })
  );
  const indexPath = path.resolve(distPath, "index.html");

  // Path-less catch-all (was app.use("*", ...)) — see setupVite for why.
  //
  // This used to answer every unmatched URL with a 200 and the app shell,
  // which made every typo, dead inbound link and probe look like a real
  // page to a crawler (see spaShell.ts). Now the path is checked against
  // the route table: a real route gets its 200, anything else gets an
  // honest 404 with the same shell, so the reader still sees the styled
  // "Transmission lost" page. Dev keeps the blanket 200 — Vite's own
  // module and HMR requests fall through here and a 404 would break them.
  app.use(async (req, res, next) => {
    try {
      const known = isKnownRoute(req.path);
      res.setHeader("Cache-Control", "no-store");
      // A 404 must never be indexed, and neither must the private routes.
      if (known && !isNoindexRoute(req.path)) {
        res.sendFile(indexPath);
        return;
      }
      const html = await fs.promises.readFile(indexPath, "utf-8");
      res.status(known ? 200 : 404);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(withNoindex(html));
    } catch (err) {
      next(err);
    }
  });
}
