import { readReelStorySource } from "../db/reelStorySource";
import { reelRenderRecordSchema, type ReelRenderRecord } from "../video/reelRenderRecord";
import { reelPublicationRecord } from "./reelStatus";

export type ReelRenderAudit =
  | { state: "recorded"; postId: string; render: ReelRenderRecord }
  | { state: "not-recorded" | "unavailable" | "unconfirmed"; postId: string | null; render: null };

/** A staged export is not a publication. Only join it to a durable confirmed
 * receipt for this exact evidence identity. Historical missing data stays unknown. */
export async function readReelRenderAudit(publication: {
  key: string;
  date: string;
}): Promise<ReelRenderAudit> {
  let postId: string | null = null;
  try {
    const receipt = await reelPublicationRecord(publication);
    if (receipt.state === "unavailable")
      return { state: "unavailable", postId: null, render: null };
    if (receipt.state !== "published" || !receipt.postId)
      return { state: "unconfirmed", postId: null, render: null };
    postId = receipt.postId;
    const source = await readReelStorySource(publication);
    if (source?.render == null) return { state: "not-recorded", postId, render: null };
    const parsed = reelRenderRecordSchema.safeParse(source.render);
    if (!parsed.success) return { state: "unavailable", postId, render: null };
    return { state: "recorded", postId, render: parsed.data };
  } catch {
    return { state: "unavailable", postId, render: null };
  }
}
