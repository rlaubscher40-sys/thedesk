import { afterEach, expect, it, vi } from "vitest";
const mode = vi.hoisted(() => ({ demo: true }));
vi.mock("../demo/store", () => ({ isDemoMode: () => mode.demo }));
vi.mock("./client", () => ({ getDb: () => null }));
import {
  assertPublicationAllowed,
  publicationControls,
  publicationControlEvents,
  setPublicationControl,
} from "./publicationControls";
import { publishContainer } from "../instagram/api";
import { send } from "../core/mailer";
import { insertFeedOnce } from "./feedClaims";
import { legalRouter } from "../routers/legal";
import { sensitiveStoryReasons } from "../../shared/publicationControls";

async function pause(channel: "all" | "email" | "social", paused: boolean) {
  const current = (await publicationControls()).find((c) => c.channel === channel)!;
  await setPublicationControl({
    channel,
    paused,
    reason: "Synthetic incident test",
    actorId: 1,
    expectedRevision: current.revision,
  });
}
afterEach(async () => {
  mode.demo = true;
  await pause("all", false);
  await pause("email", false);
  await pause("social", false);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("stops website writes and social/email requests, while confirmations can continue", async () => {
  await pause("all", true);
  const fetcher = vi.fn(
    async () => new Response(JSON.stringify({ id: "receipt" }), { status: 200 })
  );
  vi.stubGlobal("fetch", fetcher);
  vi.stubEnv("RESEND_API_KEY", "test-only");
  await expect(
    publishContainer({ igUserId: "123", accessToken: "test-only", creationId: "456" })
  ).rejects.toThrow("Publishing paused");
  await expect(
    send({
      to: "test@example.com",
      subject: "Brief",
      html: "synthetic",
      headers: { "List-Unsubscribe": "<https://example.com/unsubscribe>" },
    })
  ).rejects.toThrow("Publishing paused");
  await expect(
    insertFeedOnce({
      title: "Test",
      source: "Synthetic",
      summary: "Test",
      category: "PROPERTY",
      feedDate: "2026-09-14",
    })
  ).rejects.toThrow("Publishing paused");
  expect(fetcher).not.toHaveBeenCalled();
  await expect(
    send({ to: "test@example.com", subject: "Confirm", html: "synthetic" })
  ).resolves.toMatchObject({ delivered: true });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("keeps channel pauses independent and rejects stale updates", async () => {
  await pause("social", true);
  await expect(assertPublicationAllowed("email")).resolves.toBeUndefined();
  await expect(assertPublicationAllowed("social")).rejects.toThrow("Publishing paused");
  await expect(
    setPublicationControl({
      channel: "social",
      paused: false,
      reason: "Stale request",
      actorId: 1,
      expectedRevision: 0,
    })
  ).rejects.toThrow("refresh");
  expect((await publicationControlEvents())[0]).toMatchObject({
    channel: "social",
    paused: true,
    actorId: 1,
  });
});
it("fails closed when durable controls cannot be read in production mode", async () => {
  mode.demo = false;
  await expect(assertPublicationAllowed("social")).rejects.toThrow("unavailable");
});
it("keeps private controls, review actions and privacy lookups admin-only", async () => {
  const caller = legalRouter.createCaller({ user: null } as never);
  await expect(caller.controls()).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(caller.reviews()).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(caller.privacyInventory({ email: "test@example.com" })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(
    caller.holdStory({ feedItemId: 1, note: "Synthetic incident test note" })
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    caller.setControl({
      channel: "all",
      paused: false,
      reason: "Synthetic request",
      expectedRevision: 0,
    })
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it("flags allegations, restrictions and explicit sponsorship without stopping routine market reporting", () => {
  expect(
    sensitiveStoryReasons("Developer charged with fraud; identity is suppressed")
  ).toHaveLength(2);
  expect(sensitiveStoryReasons("Sponsored by a lender")).toHaveLength(1);
  expect(sensitiveStoryReasons("RBA leaves interest rates unchanged as approvals rise")).toEqual(
    []
  );
});
