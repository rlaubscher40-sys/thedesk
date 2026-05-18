/**
 * Express + tRPC + Vite entry point. In dev the Vite middleware serves the
 * client; in production it falls back to the static bundle in dist/public.
 */
import "dotenv/config";

import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import rateLimit from "express-rate-limit";
import { createServer } from "node:http";
import net from "node:net";
import { createContext } from "./core/context";
import { registerHealthRoutes, recordExpressError } from "./core/healthRoutes";
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

  // Railway terminates TLS at its proxy. `trust proxy` makes req.ip
  // resolve to the real client IP from x-forwarded-for instead of the
  // proxy hop, without this every rate-limit bucket would key on a
  // single Railway internal IP and effectively allow nothing.
  app.set("trust proxy", 1);

  // Tight body limit, nothing on the API accepts payloads larger than
  // a few hundred KB (largest is the weekly-edition synthesis result,
  // which lands well under 1MB). 50MB was inherited from an earlier
  // image-bytes-over-the-wire flow that no longer exists. Keeping the
  // ceiling low protects every endpoint from memory-bomb spam.
  app.use(express.json({ limit: "4mb" }));
  app.use(express.urlencoded({ limit: "4mb", extended: true }));

  // ── Rate limits, keyed per IP, in-memory store. Railway runs a
  //    single instance so in-memory is fine until horizontal scale
  //    becomes a thing (then bring Redis).
  //
  //    Two buckets:
  //    · /api/trpc      , 90 / minute. Real users sit well under this
  //                        even when flipping fast between Today /
  //                        Archive / Edition, tRPC batches their
  //                        queries. Scrapers hammering one page after
  //                        another trip the limit inside a few seconds.
  //    · /api/auth/login, 10 / 5 minutes. Defends the only password
  //                        endpoint from credential-stuffing. Real
  //                        humans never trip this.
  const trpcLimiter = rateLimit({
    windowMs: 60_000,
    limit: 90,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests. Slow down." },
  });
  const loginLimiter = rateLimit({
    windowMs: 5 * 60_000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: "Too many login attempts. Try again in a few minutes." },
  });
  app.use("/api/auth/login", loginLimiter);

  registerOAuthRoutes(app);
  registerSeoRoutes(app);
  registerHealthRoutes(app);
  registerScheduledRoutes(app);

  app.use(
    "/api/trpc",
    trpcLimiter,
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

  // Persist uncaught errors into the local server_errors table. The
  // admin /health page reads from there; Sentry was removed in favour
  // of the internal tracker. recordExpressError calls next(err) and
  // the final handler below sends the JSON 500 response.
  app.use(recordExpressError);

  app.use(
    (
      _err: Error,
      _req: import("express").Request,
      res: import("express").Response,
      _next: import("express").NextFunction
    ): void => {
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

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
