/**
 * Top-level tRPC router. Each sub-router is in its own file so this file stays
 * a one-screen index of every callable procedure.
 */
import { router } from "../core/trpc";
import { authRouter } from "./auth";
import { editionsRouter } from "./editions";
import { feedRouter } from "./feed";
import { feedbackRouter } from "./feedback";
import { healthRouter } from "./health";
import { heroLibraryRouter } from "./heroLibrary";
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
  feedback: feedbackRouter,
  health: healthRouter,
  topics: topicsRouter,
  readingQueue: readingQueueRouter,
  trends: trendsRouter,
  search: searchRouter,
  subscribers: subscribersRouter,
  linkedIn: linkedInRouter,
  metrics: metricsRouter,
  heroLibrary: heroLibraryRouter,
});

export type AppRouter = typeof appRouter;
