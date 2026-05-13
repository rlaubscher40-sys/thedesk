/**
 * Top-level tRPC router. Each sub-router is in its own file so this file stays
 * a one-screen index of every callable procedure.
 */
import { router } from "../core/trpc";
import { authRouter } from "./auth";
import { editionsRouter } from "./editions";
import { feedRouter } from "./feed";
import { topicsRouter } from "./topics";
import { readingQueueRouter } from "./readingQueue";
import { notesRouter } from "./notes";
import { conversationsRouter } from "./conversations";
import { trendsRouter } from "./trends";
import { searchRouter } from "./search";

export const appRouter = router({
  auth: authRouter,
  editions: editionsRouter,
  feed: feedRouter,
  topics: topicsRouter,
  readingQueue: readingQueueRouter,
  notes: notesRouter,
  conversations: conversationsRouter,
  trends: trendsRouter,
  search: searchRouter,
});

export type AppRouter = typeof appRouter;
