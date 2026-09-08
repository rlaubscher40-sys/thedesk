import { readJobRun } from "../db/jobRuns";

export async function reelPublicationRecord(publication: { key: string; date: string }) {
  try {
    const row = await readJobRun(publication.key, publication.date);
    if (!row) return { state: "available" as const, postId: null, detail: null };
    const postId =
      row.status === "success" ? (row.detail?.match(/^Published media (\d+)$/)?.[1] ?? null) : null;
    return {
      state: postId ? ("published" as const) : ("locked" as const),
      postId,
      publishedAt: postId ? (row.finishedAt ?? row.startedAt ?? null) : null,
      detail: row.detail,
    };
  } catch {
    return { state: "unavailable" as const, postId: null, detail: null };
  }
}

export async function reelPublicationStatus(publication: {
  key: string;
  date: string;
}): Promise<"available" | "locked" | "unavailable"> {
  const record = await reelPublicationRecord(publication);
  return record.state === "published" ? "locked" : record.state;
}
