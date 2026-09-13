import { formatMetricValue, historyChange } from "../../shared/metricPresentation";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { consumeAnonymousCard } from "../core/askQuota";
import * as db from "../db";
import { renderSignalCard } from "../core/publicRender";
import { publicProcedure, router } from "../core/trpc";
import { signalSharePath, signalSnapshotId } from "../../shared/signalSnapshot";
import { loadSharedSignal } from "../metrics/sharedSignal";

function formatAsOf(value: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Sydney",
  }).format(value);
}

export const signalsRouter = router({
  /**
   * Render The Number from a trusted metric key only. All visible copy comes
   * from current Desk data, its 30-day history and the latest published Desk
   * Take, so a public caller cannot manufacture a branded statistic or source.
   */
  shareCard: publicProcedure
    .input(
      z.object({ metricKey: z.string().min(1).max(64), snapshot: signalSnapshotId.optional() })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        const quota = await consumeAnonymousCard(ctx.req);
        if (!quota.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `You've used today's ${quota.limit} free social-card renders. Sign in to keep going.`,
          });
        }
      }

      const snapshot = await loadSharedSignal(input.metricKey, input.snapshot);
      const { metric } = snapshot;
      if (!input.snapshot) {
        const editions = await db.listEditionSummaries();
        const edition = editions.find((item) => item.rubensTake?.trim());
        snapshot.deskTake = edition?.rubensTake ?? null;
        snapshot.editionNumber = edition?.editionNumber ?? null;
        snapshot.move = historyChange(metric, snapshot.series);
      }

      try {
        const png = await renderSignalCard({
          label: metric.label,
          value: formatMetricValue(metric),
          context: metric.context ?? null,
          move: snapshot.move,
          deskTake: snapshot.deskTake,
          source: metric.source ?? null,
          asOf: formatAsOf(metric.asOf),
        });
        const snapshotId = input.snapshot ?? (await db.storeSignalSnapshot(snapshot));
        return {
          mimeType: "image/png" as const,
          filename: "the-desk-the-number.png",
          base64: png.toString("base64"),
          sharePath: signalSharePath(metric.metricKey, snapshotId),
          label: metric.label,
          value: formatMetricValue(metric),
        };
      } catch (error) {
        console.error("[signals] card render failed", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The Desk could not render the signal card.",
        });
      }
    }),
});
