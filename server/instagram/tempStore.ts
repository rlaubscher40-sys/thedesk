/**
 * In-memory store for Instagram temporary images.
 *
 * Instagram's Graph API fetches image URLs at container-creation time, so
 * images normally only need to be reachable for the few seconds the API call
 * takes. They must also outlive the retry ladder in ./api, though: a Meta-side
 * 500 can push container creation out by a minute or more per call, and an
 * image that expired mid-retry would turn a recoverable blip into a permanent
 * failure. A 15-minute TTL covers the full retry window with room to spare;
 * the posting flow deletes each entry in a `finally` the moment it's done, so
 * the longer ceiling costs nothing in practice.
 */
import { randomUUID } from "node:crypto";

interface TempEntry {
  buffer: Buffer;
  contentType: string;
  expiresAt: number;
}

const store = new Map<string, TempEntry>();
const TTL_MS = 15 * 60 * 1000;

// Sweep expired entries once per minute.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt < now) store.delete(key);
  }
}, 60_000).unref();

export function storeTempImage(buffer: Buffer, contentType = "image/jpeg"): string {
  const uuid = randomUUID();
  store.set(uuid, { buffer, contentType, expiresAt: Date.now() + TTL_MS });
  return uuid;
}

export function getTempImage(uuid: string): { buffer: Buffer; contentType: string } | null {
  const entry = store.get(uuid);
  if (!entry) return null;
  // Enforce the TTL on read too — the sweeper only runs once a minute,
  // so without this an expired entry stays servable until the next sweep.
  if (entry.expiresAt < Date.now()) {
    store.delete(uuid);
    return null;
  }
  return { buffer: entry.buffer, contentType: entry.contentType };
}

export function removeTempImage(uuid: string): void {
  store.delete(uuid);
}
