import type { Express } from "express";
import { env } from "./env";

/**
 * /manus-storage/{key} resolves the key to a Forge-signed S3 URL and 307s the
 * client to it. Kept tiny because the heavy lifting is in core/storage.ts.
 */
export function registerStorageProxy(app: Express): void {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!env.forgeApiUrl || !env.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL("v1/storage/presign/get", `${env.forgeApiUrl.replace(/\/+$/, "")}/`);
      forgeUrl.searchParams.set("path", key);
      const r = await fetch(forgeUrl, { headers: { Authorization: `Bearer ${env.forgeApiKey}` } });
      if (!r.ok) {
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = (await r.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[storageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
