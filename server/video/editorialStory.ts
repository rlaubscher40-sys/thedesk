export type EditorialBeat = {
  statement: string;
  evidence: string;
  sceneKeys: string[];
};
export type EditorialStory = {
  finding: EditorialBeat;
  explanation: EditorialBeat;
  consequence: EditorialBeat;
  takeaway: EditorialBeat;
  limits: string;
};

/** Structural gate before rendering. Editorial judgement still requires review:
 * populated fields alone do not establish truth, relevance or clarity. */
export function assertEditorialStory(brief: EditorialStory, sceneKeys: string[]) {
  if (!brief || !brief.limits?.trim()) throw new Error("Missing editorial story limits.");
  const keys = new Set(sceneKeys);
  for (const name of ["finding", "explanation", "consequence", "takeaway"] as const) {
    const beat = brief[name];
    if (
      !beat?.statement?.trim() ||
      !beat.evidence?.trim() ||
      !beat.sceneKeys?.length ||
      beat.sceneKeys.some((key) => !keys.has(key))
    )
      throw new Error(`Incomplete editorial ${name}: evidence and an actual scene are required.`);
  }
}
