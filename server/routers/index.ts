/**
 * Top-level tRPC router. Each sub-router is in its own file so this file stays
 * a one-screen index of every callable procedure.
 */
import { router } from "../core/trpc";
import { authRouter } from "./auth";
import { conversationsRouter } from "./conversations";
import { editionsRouter } from "./editions";
import { feedRouter } from "./feed";
import { notesRouter } from "./notes";
import { readingQueueRouter } from "./readingQueue";
import { linkedInRouter } from "./linkedIn";
import { metricsRouter } from "./metrics";
import { searchRouter } from "./search";
import { subscribersRouter } from "./subscribers";
import { systemRouter } from "./system";
import { topicsRouter } from "./topics";
import { trendsRouter } from "./trends";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  editions: editionsRouter,
  feed: feedRouter,
  topics: topicsRouter,
  readingQueue: readingQueueRouter,
  notes: notesRouter,
  conversations: conversationsRouter,
  trends: trendsRouter,
  search: searchRouter,
  subscribers: subscribersRouter,
  linkedIn: linkedInRouter,
  metrics: metricsRouter,
});

export type AppRouter = typeof appRouter;
