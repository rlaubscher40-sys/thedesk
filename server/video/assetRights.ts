import { createHash } from "node:crypto";

export type ReviewedPhoto = {
  asset: string;
  credit: string;
  source: string;
  licence: string;
  reviewed: string;
  sha256: string;
  purpose: string;
};

/** Enforces the recorded asset identity, not a legal opinion about its licence.
 * Individual download evidence is accepted; search result pages are not.
 */
export function assertReviewedPhotoBytes(photo: ReviewedPhoto, data: string | Buffer): void {
  for (const key of ["source", "licence"] as const) {
    const url = new URL(photo[key]);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      /\/(?:search|s\/photos)(?:\/|$)/i.test(url.pathname)
    )
      throw new Error(`Individual rights evidence required: ${photo.asset}`);
  }
  if (
    !photo.credit.trim() ||
    !photo.purpose.trim() ||
    !/^\d{4}-\d{2}-\d{2}$/.test(photo.reviewed) ||
    !/^[a-f0-9]{64}$/.test(photo.sha256)
  )
    throw new Error(`Incomplete rights record: ${photo.asset}`);
  if (typeof data === "string" && !/^data:image\/[a-z0-9.+-]+;base64,/i.test(data))
    throw new Error(`Image bytes required: ${photo.asset}`);
  const bytes =
    typeof data === "string" ? Buffer.from(data.slice(data.indexOf(",") + 1), "base64") : data;
  if (createHash("sha256").update(bytes).digest("hex") !== photo.sha256)
    throw new Error(`Reviewed photograph changed: ${photo.asset}`);
}
