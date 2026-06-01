/**
 * In-memory store for Instagram temporary images.
 *
 * Instagram's Graph API fetches image URLs at container-creation time, so
 * images only need to be reachable for the few seconds the API call takes.
 * We keep them in memory with a 5-minute TTL, which is more than enough.
 */
import { randomUUID } from "node:crypto";

interface TempEntry {
  buffer: Buffer;
  contentType: string;
  expiresAt: number;
}

const store = new Map<string, TempEntry>();
const TTL_MS = 5 * 60 * 1000;

// Sweep expired entries once per minute.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt < now) store.delete(key);
  }
}, 60_000).unref();

export function storeTempImage(
  buffer: Buffer,
  contentType = "image/jpeg"
): string {
  const uuid = randomUUID();
  store.set(uuid, { buffer, contentType, expiresAt: Date.now() + TTL_MS });
  return uuid;
}

export function getTempImage(
  uuid: string
): { buffer: Buffer; contentType: string } | null {
  const entry = store.get(uuid);
  if (!entry) return null;
  return { buffer: entry.buffer, contentType: entry.contentType };
}

export function removeTempImage(uuid: string): void {
  store.delete(uuid);
}
