/**
 * Manus storage helper: PUT to a Forge-presigned URL and return the
 * /manus-storage/{key} path our storageProxy will resolve at read time.
 */
import { env } from "./env";

function requireForge() {
  if (!env.forgeApiUrl || !env.forgeApiKey) {
    throw new Error("Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY");
  }
  return { url: env.forgeApiUrl.replace(/\/+$/, ""), key: env.forgeApiKey };
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { url: base, key: forgeKey } = requireForge();
  const key = appendHashSuffix(relKey.replace(/^\/+/, ""));

  const presignUrl = new URL("v1/storage/presign/put", `${base}/`);
  presignUrl.searchParams.set("path", key);

  const presignRes = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  });
  if (!presignRes.ok) {
    throw new Error(`Storage presign failed (${presignRes.status})`);
  }
  const { url: s3Url } = (await presignRes.json()) as { url: string };
  if (!s3Url) throw new Error("Empty presign URL");

  const body =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as BlobPart], { type: contentType });

  const uploadRes = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
  });
  if (!uploadRes.ok) {
    throw new Error(`Storage upload failed (${uploadRes.status})`);
  }
  return { key, url: `/manus-storage/${key}` };
}

/** Resolve a signed read URL for a stored key (used by storageProxy). */
export async function storageSignedReadUrl(relKey: string): Promise<string> {
  const { url: base, key: forgeKey } = requireForge();
  const key = relKey.replace(/^\/+/, "");
  const u = new URL("v1/storage/presign/get", `${base}/`);
  u.searchParams.set("path", key);
  const res = await fetch(u, { headers: { Authorization: `Bearer ${forgeKey}` } });
  if (!res.ok) throw new Error(`Storage signed URL failed (${res.status})`);
  const { url } = (await res.json()) as { url: string };
  return url;
}
