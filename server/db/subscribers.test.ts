import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  row: {} as Record<string, unknown>,
  writes: [] as Record<string, unknown>[],
  events: [] as Record<string, unknown>[],
}));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
vi.mock("./client", () => {
  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [state.row], for: async () => [state.row] }),
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        const pending = Promise.resolve().then(() => {
          if (values.event) state.events.push(values);
        });
        return Object.assign(pending, { onDuplicateKeyUpdate: async () => undefined });
      },
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          state.writes.push(values);
          Object.assign(state.row, values);
        },
      }),
    }),
  };
  return {
    getDb: () => ({
      ...tx,
      transaction: async (run: (db: typeof tx) => Promise<unknown>) => {
        const before = { ...state.row };
        const eventCount = state.events.length;
        try {
          return await run(tx);
        } catch (error) {
          state.row = before;
          state.events.length = eventCount;
          throw error;
        }
      },
    }),
  };
});
import { createSubscriber, confirmSubscriber, unsubscribeByEmail } from "./subscribers";
beforeEach(() => {
  state.row = {
    id: 1,
    email: "reader@example.com",
    confirmedAt: new Date(),
    unsubscribedAt: new Date(),
    confirmToken: null,
    confirmTokenSentAt: null,
  };
  state.writes = [];
  state.events = [];
});
describe("subscription consent lifecycle", () => {
  it("preserves the current request wording after confirmation and does not invent it for older clients", async () => {
    await createSubscriber({
      email: "reader@example.com",
      confirmToken: "new-token",
      source: "subscribe-page",
      consentNoticeVersion: "2026-09-14",
    });
    expect(state.row.consentNoticeVersion).toBe("2026-09-14");
    const requestedAt = state.row.consentRequestedAt;
    expect(requestedAt).toBeInstanceOf(Date);
    await confirmSubscriber("new-token");
    expect(state.row.consentRequestedAt).toBe(requestedAt);
    expect(state.row.consentNoticeVersion).toBe("2026-09-14");
    await unsubscribeByEmail("reader@example.com");
    await createSubscriber({ email: "reader@example.com", confirmToken: "older-client-token" });
    expect(state.row.consentNoticeVersion).toBeNull();
    expect(state.row.confirmedAt).toBeNull();
    expect(state.row.unsubscribedAt).toBeInstanceOf(Date);
    expect(state.events.map((e) => e.event)).toEqual([
      "requested",
      "confirmed",
      "unsubscribed",
      "requested",
    ]);
    expect(state.events[0]?.noticeVersion).toBe("2026-09-14");
    expect(state.events[3]?.noticeVersion).toBeNull();
    expect(state.events.every((e) => !("confirmToken" in e) && !("email" in e))).toBe(true);
  });
  it("keeps a returning subscriber suppressed until the new confirmation", async () => {
    const oldOptOut = state.row.unsubscribedAt;
    const pending = await createSubscriber({
      email: "reader@example.com",
      confirmToken: "new-token",
    });
    expect(pending?.confirmedAt).toBeNull();
    expect(pending?.unsubscribedAt).toBe(oldOptOut);
    expect(pending?.confirmToken).toBe("new-token");
    await confirmSubscriber("new-token");
    expect(state.row.confirmedAt).toBeInstanceOf(Date);
    expect(state.row.unsubscribedAt).toBeNull();
    expect(state.row.confirmToken).toBeNull();
  });
  it("does not disturb an active subscriber", async () => {
    state.row.unsubscribedAt = null;
    const before = { ...state.row };
    await createSubscriber({ email: "reader@example.com", confirmToken: "new-token" });
    expect(state.row).toEqual(before);
    expect(state.writes).toEqual([]);
  });
  it("invalidates outstanding confirmation links when unsubscribing", async () => {
    Object.assign(state.row, { confirmToken: "pending-token", confirmTokenSentAt: new Date() });
    await unsubscribeByEmail("reader@example.com");
    expect(state.row.unsubscribedAt).toBeInstanceOf(Date);
    expect(state.row.confirmToken).toBeNull();
    expect(state.row.confirmTokenSentAt).toBeNull();
  });
});
