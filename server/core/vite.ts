import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";
import type { Server } from "node:http";
import { createServer as createViteServer } from "vite";

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
  app.use("*", async (req, res, next) => {
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
  app.use("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
