import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { DOCUMENTARY_REVIEWS } from "./documentaryReviews";
import { documentaryReviewHash, type DocumentaryStory } from "../video/documentaryStory";

const parts: Record<string, number> = {
  "grollo-family": 3,
  "lowy-westfield": 2,
  "triguboff-apartments": 6,
  "walker-rebuild": 2,
};

/** Publish the approved saved bytes. Never silently regenerate an approved film.
 * Small binary parts keep authenticated repository transfers bounded. The full
 * MP4 digest, not file extension or successful concatenation, establishes identity. */
export async function approvedDocumentaryExport(story: DocumentaryStory) {
  const review = DOCUMENTARY_REVIEWS[story.id];
  const count = parts[story.id];
  if (!review || !count || review.hash !== documentaryReviewHash(story))
    throw new Error("Documentary export does not match approved render inputs.");
  const directory = path.resolve(process.cwd(), "server/instagram/documentary-media", story.id);
  const chunks = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      fs.readFile(path.join(directory, `part-${String(i).padStart(2, "0")}.bin`))
    )
  );
  const bytes = Buffer.concat(chunks);
  if (createHash("sha256").update(bytes).digest("hex") !== review.videoSha256)
    throw new Error("Approved documentary MP4 is missing or changed.");
  return {
    bytes,
    seconds: review.seconds,
    narrated: true,
    subtitled: true,
    spokenBy: review.voice.engine,
    voice: { ...review.voice },
  };
}
