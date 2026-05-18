import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "../db";
import { resolveHeroForEdition } from "../core/heroSelection";
import { generateImage } from "../core/image";
import { adminProcedure, publicProcedure, router } from "../core/trpc";
import {
  editionHeroPrompt,
  generateRubensTake,
  generateSubstackDraft,
  substackHeroPrompt,
} from "../prompts";

const editionIdInput = z.object({ editionId: z.number().int().positive() });

/** Subset of EditionTopic fields the admin can patch in place. */
const topicPatchInput = z.object({
  editionId: z.number().int().positive(),
  topicIndex: z.number().int().min(0).max(20),
  title: z.string().min(1).max(300).optional(),
  summary: z.string().min(1).max(2000).optional(),
  body: z.string().max(20000).optional().nullable(),
  whyItMatters: z.string().max(2000).optional().nullable(),
  keyTakeaway: z.string().max(2000).optional().nullable(),
  whatToWatch: z.array(z.string().max(400)).max(8).optional().nullable(),
});

export const editionsRouter = router({
  /**
   * Lean list view of every edition. Drops the heavy text columns
   * (fullText / substackDraftBody / topics / signals) the list never
   * reads, cuts the payload from MBs to tens of KBs once you have a
   * year of editions, and keeps the React Query cache light. Callers
   * that need the full document fetch it through getByNumber.
   */
  list: publicProcedure.query(async () => {
    const rows = await db.listEditionSummaries();
    return rows.map((ed) => ({
      ...ed,
      title: `Edition ${ed.editionNumber}: ${ed.weekRange}`,
    }));
  }),

  getById: publicProcedure.input(editionIdInput).query(async ({ input }) => {
    return db.getEditionById(input.editionId);
  }),

  getByNumber: publicProcedure
    .input(z.object({ editionNumber: z.number().int().positive() }))
    .query(async ({ input }) => {
      return db.getEditionByNumber(input.editionNumber);
    }),

  search: publicProcedure.input(z.object({ query: z.string().min(1) })).query(async ({ input }) => {
    return db.searchEditionFullText(input.query);
  }),

  /** Admin: regenerate Ruben's Take for a single edition. */
  generateRubensTake: adminProcedure.input(editionIdInput).mutation(async ({ input }) => {
    const edition = await db.getEditionById(input.editionId);
    if (!edition) throw new TRPCError({ code: "NOT_FOUND", message: "Edition not found" });
    const take = await generateRubensTake({
      weekRange: edition.weekRange,
      topics: edition.topics,
      keyMetrics: edition.keyMetrics,
    });
    await db.updateRubensTake(edition.id, take);
    return { rubensTake: take };
  }),

  /** Admin: manually overwrite Ruben's Take (post-edit). */
  updateRubensTake: adminProcedure
    .input(editionIdInput.extend({ rubensTake: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await db.updateRubensTake(input.editionId, input.rubensTake);
      return { success: true };
    }),

  /**
   * Admin: fill in Ruben's Take for every edition that doesn't have one. Run
   * in parallel with allSettled so one failure doesn't sink the rest.
   */
  backfillRubensTake: adminProcedure.mutation(async () => {
    const all = await db.listEditions();
    const missing = all.filter((e) => !e.rubensTake);
    type Result = {
      editionId: number;
      editionNumber: number;
      success: boolean;
      error?: string;
    };
    const settled = await Promise.allSettled(
      missing.map(async (edition): Promise<Result> => {
        const take = await generateRubensTake({
          weekRange: edition.weekRange,
          topics: edition.topics,
          keyMetrics: edition.keyMetrics,
        });
        await db.updateRubensTake(edition.id, take);
        return { editionId: edition.id, editionNumber: edition.editionNumber, success: true };
      })
    );
    const results: Result[] = settled.map((s, i) => {
      const edition = missing[i]!;
      if (s.status === "fulfilled") return s.value;
      return {
        editionId: edition.id,
        editionNumber: edition.editionNumber,
        success: false,
        error: s.reason instanceof Error ? s.reason.message : String(s.reason),
      };
    });
    return { processed: missing.length, results };
  }),

  /** Admin: generate full Substack draft (essay + hero image). */
  generateSubstackDraft: adminProcedure.input(editionIdInput).mutation(async ({ input }) => {
    const edition = await db.getEditionById(input.editionId);
    if (!edition) throw new TRPCError({ code: "NOT_FOUND", message: "Edition not found" });
    const draft = await generateSubstackDraft({
      weekRange: edition.weekRange,
      topics: edition.topics,
      keyMetrics: edition.keyMetrics,
      rubensTake: edition.rubensTake,
    });
    let imageUrl: string | null = null;
    try {
      const result = await generateImage({
        prompt: substackHeroPrompt({ title: draft.title, topics: edition.topics }),
      });
      if (result) {
        await db.storeEditionAsset({
          editionId: edition.id,
          kind: "substack",
          contentType: result.contentType,
          bytes: result.bytes,
        });
        imageUrl = db.editionAssetUrl(edition.id, "substack");
      }
    } catch (err) {
      console.warn("[editions] substack hero image failed:", err);
    }
    await db.updateSubstackDraft(edition.id, { ...draft, imageUrl });
    return { ...draft, imageUrl };
  }),

  /** Admin: persist hand-edited Substack draft. */
  saveSubstackDraft: adminProcedure
    .input(
      editionIdInput.extend({
        title: z.string().min(1),
        subtitle: z.string().min(1),
        body: z.string().min(1),
        imageUrl: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await db.updateSubstackDraft(input.editionId, {
        title: input.title,
        subtitle: input.subtitle,
        body: input.body,
        imageUrl: input.imageUrl ?? null,
      });
      return { success: true };
    }),

  /**
   * Admin: regenerate just the Substack hero image. Listed as improvement #7 —
   * lets the user swap the image without rewriting the essay.
   */
  regenerateSubstackImage: adminProcedure.input(editionIdInput).mutation(async ({ input }) => {
    const edition = await db.getEditionById(input.editionId);
    if (!edition) throw new TRPCError({ code: "NOT_FOUND", message: "Edition not found" });
    const title = edition.substackDraftTitle ?? `Edition ${edition.editionNumber}`;
    const result = await generateImage({
      prompt: substackHeroPrompt({ title, topics: edition.topics }),
    });
    if (!result) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Image generation is not configured. Set OPENAI_API_KEY to enable.",
      });
    }
    await db.storeEditionAsset({
      editionId: edition.id,
      kind: "substack",
      contentType: result.contentType,
      bytes: result.bytes,
    });
    const url = db.editionAssetUrl(edition.id, "substack");
    await db.updateSubstackImage(edition.id, url);
    return { imageUrl: url };
  }),

  /**
   * Admin: patch one topic on an edition in place. Used by the topic-edit
   * drawer in the reader so the editor can fix a single paragraph without
   * having to regenerate the whole edition. Each patch field is optional —
   * only what's supplied gets written.
   */
  updateTopic: adminProcedure.input(topicPatchInput).mutation(async ({ input }) => {
    const edition = await db.getEditionById(input.editionId);
    if (!edition) throw new TRPCError({ code: "NOT_FOUND", message: "Edition not found" });
    const topics = [...edition.topics];
    const target = topics[input.topicIndex];
    if (!target) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Topic index ${input.topicIndex} out of range`,
      });
    }
    topics[input.topicIndex] = {
      ...target,
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      // Pass nulls through as "clear this optional field" rather than
      // unset, undefined means "don't touch", null means "blank it".
      ...(input.body !== undefined ? { body: input.body ?? undefined } : {}),
      ...(input.whyItMatters !== undefined
        ? { whyItMatters: input.whyItMatters ?? undefined }
        : {}),
      ...(input.keyTakeaway !== undefined
        ? { keyTakeaway: input.keyTakeaway ?? undefined }
        : {}),
      ...(input.whatToWatch !== undefined
        ? { whatToWatch: input.whatToWatch ?? undefined }
        : {}),
    };
    await db.updateEditionSynthesis(edition.id, { topics });
    return { success: true } as const;
  }),

  /**
   * Admin: set / refresh the EditionReader hero image.
   *
   * Default behaviour is to pick the next image from the hero library
   * (least-recently-used). Pass `forceFresh: true` to skip the library
   * and call OpenAI, use that for landmark editions where the cover
   * needs to be tied to the week's content.
   */
  generateHeroImage: adminProcedure
    .input(editionIdInput.extend({ forceFresh: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const edition = await db.getEditionById(input.editionId);
      if (!edition)
        throw new TRPCError({ code: "NOT_FOUND", message: "Edition not found" });
      const result = await resolveHeroForEdition({
        editionId: edition.id,
        prompt: editionHeroPrompt({
          weekRange: edition.weekRange,
          topics: edition.topics,
        }),
        forceFresh: input.forceFresh ?? false,
      });
      if (!result.ok) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Hero library is empty and image generation is not configured. Seed the library or set OPENAI_API_KEY.",
        });
      }
      const url = db.editionAssetUrl(edition.id, "hero");
      await db.updateHeroImage(edition.id, url);
      return { url, source: result.source };
    }),

  /**
   * Admin: delete an edition. Used to clean up a thin first-pass synthesis
   * before re-running the weekly workflow.
   */
  deleteEdition: adminProcedure.input(editionIdInput).mutation(async ({ input }) => {
    await db.deleteEdition(input.editionId);
    return { success: true } as const;
  }),
});
