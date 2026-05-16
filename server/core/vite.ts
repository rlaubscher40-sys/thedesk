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
  // Resolve from the working directory, not from import.meta.dirname — the
  // server is esbuild-bundled in production so the source path no longer
  // matches the bundled location at runtime. `process.cwd()` is set by
  // `node dist/index.js` to the project root regardless.
  const distPath = path.resolve(process.cwd(), "dist", "public");
  if (!fs.existsSync(distPath)) {
    console.error(`[static] missing build directory ${distPath}`);
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => res.sendFile(path.resolve(distPath, "index.html")));
}
