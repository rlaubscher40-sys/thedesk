import { isDemoMode } from "../demo/store";
import { publicProcedure, router } from "../core/trpc";

/**
 * Public system endpoints used to drive UI affordances like the demo-mode
 * banner. Cheap, no auth, safe to call from anonymous clients.
 */
export const systemRouter = router({
  demoMode: publicProcedure.query(() => ({ demoMode: isDemoMode() })),
});
