import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import { expect, it, vi } from "vitest";
import { serveStatic } from "./vite";

it("revalidates recovery files while retaining immutable caching for hashed bundles", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "desk-static-"));
  const root = path.join(directory, "dist/public");
  mkdirSync(path.join(root, "assets"), { recursive: true });
  for (const file of ["index.html", "sw.js", "offline.html", "manifest.json", "assets/app-123.js"])
    writeFileSync(path.join(root, file), file.endsWith(".html") ? "<!doctype html><title>The Desk</title>" : "test");
  const cwd = vi.spyOn(process, "cwd").mockReturnValue(directory);
  const app = express();
  serveStatic(app);
  cwd.mockRestore();
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const address = server.address() as { port: number };
    for (const [file, cache] of [["/", "no-store"], ["/?_desk_reload=123", "no-store"], ["/markets?_desk_reload=123", "no-store"], ["/sw.js", "no-cache"], ["/offline.html", "no-cache"], ["/manifest.json", "no-cache"], ["/assets/app-123.js", "public, max-age=31536000, immutable"]]) {
      const response = await fetch(`http://127.0.0.1:${address.port}${file}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe(cache);
      await response.text();
    }
    for (const file of ["/assets/retired.js", "/assets/retired.css"]) {
      const response = await fetch(`http://127.0.0.1:${address.port}${file}`);
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("content-type")).toContain("text/plain");
      expect(await response.text()).not.toContain("<!doctype html>");
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(directory, { recursive: true, force: true });
  }
});
