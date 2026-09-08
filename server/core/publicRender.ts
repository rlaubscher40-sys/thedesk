import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { cached } from "./cache";
import { renderSignalCard as signal } from "../og/signalCard";
import { renderTrendCard as trend } from "../og/trendCard";
import { renderIntelligenceCard as intelligence } from "../og/intelligenceCard";
import { renderDailyHookCoverCard as story } from "../og/dailyHookCover";
import { renderDeskTakeCard as take } from "../og/takeCard";
let active = 0;
/** Bound native render work across public tRPC and crawler endpoints; no unbounded queue. */
function guarded<T>(kind: string, render: (input: T) => Promise<Buffer>) {
  return (input: T) => {
    const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    return cached(`public-render:${kind}:${hash}`, 30 * 60000, async () => {
      if (active >= 2)
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Image rendering is busy. Try again shortly.",
        });
      active++;
      try {
        return await render(input);
      } finally {
        active--;
      }
    });
  };
}
export const renderSignalCard = guarded("signal", signal);
export const renderTrendCard = guarded("trend", trend);
export const renderIntelligenceCard = guarded("intelligence", intelligence);
export const renderDailyHookCoverCard = guarded("story", story);
export const renderDeskTakeCard = guarded("take", take);
