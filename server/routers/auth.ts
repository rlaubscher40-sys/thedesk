import { COOKIE_NAME } from "../../shared/const";
import { getSessionCookieOptions } from "../core/cookies";
import { publicProcedure, router } from "../core/trpc";

export const authRouter = router({
  /** Returns the current user, or null if not authenticated. Used by useAuth. */
  me: publicProcedure.query(({ ctx }) => ctx.user),
  /** Clear the session cookie. */
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});
