/** RFC 6238 SHA-1 TOTP, six digits, 30 second steps. Replay reserved at login. */
import { createHmac, timingSafeEqual } from "node:crypto";
export function decodeBase32(value: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0,
    acc = 0;
  const bytes: number[] = [];
  const clean = value.replace(/\s/g, "").replace(/=+$/, "").toUpperCase();
  if (!/^[A-Z2-7]{16,128}$/.test(clean)) throw new Error("Invalid authenticator secret");
  for (const c of clean) {
    acc = (acc << 5) | alphabet.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >>> bits) & 255);
    }
  }
  return Buffer.from(bytes);
}
export function totpAt(secret: string, step: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", decodeBase32(secret)).update(msg).digest();
  const at = digest[digest.length - 1]! & 15;
  return String((digest.readUInt32BE(at) & 0x7fffffff) % 1000000).padStart(6, "0");
}
export function verifyTotp(secret: string, code: unknown, now = Date.now()): number | null {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return null;
  const step = Math.floor(now / 30000);
  for (const n of [step, step - 1, step + 1])
    if (n >= 0 && timingSafeEqual(Buffer.from(code), Buffer.from(totpAt(secret, n)))) return n;
  return null;
}
