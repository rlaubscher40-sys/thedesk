/**
 * Express + tRPC + Vite entry point. In dev the Vite middleware serves the
 * client; in production it falls back to the static bundle in dist/public.
 */
import "dotenv/config";
import { initSentry, registerSentryErrorHandler } from "./core/sentry";

// Init Sentry FIRST so anything that throws during the rest of the
// bootstrap path (DB connect, route registration) still reports.
const sentryActive = initSentry();
if (sentryActive) {
  console.log("[boot] Sentry initialised");
}

import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import { createServer } from "node:http";
import net from "node:net";
import { createContext } from "./core/context";
import { registerOAuthRoutes } from "./core/oauth";
import { registerSeoRoutes } from "./core/seo";
import { serveStatic, setupVite } from "./core/vite";
import { appRouter } from "./routers";
import { registerScheduledRoutes } from "./scheduledRoutes";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => server.close(() => resolve(true)));
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(start: number): Promise<number> {
  for (let port = start; port < start + 20; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No port available starting from ${start}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);
  registerSeoRoutes(app);
  registerScheduledRoutes(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Last in the chain so it catches anything routes / SPA fallback let
  // through. No-op when SENTRY_DSN isn't set.
  registerSentryErrorHandler(app);

  const preferredPort = parseInt(process.env.PORT ?? "3000", 10);
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} busy, using ${port}`);
  }
  server.listen(port, () => {
    console.log(`The Desk running at http://localhost:${port}/`);
  });
}

startServer().catch((err) => {
  console.error("[boot] failed to start:", err);
  process.exitCode = 1;
});
