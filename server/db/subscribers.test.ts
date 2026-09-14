import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  row: {} as Record<string, unknown>,
  writes: [] as Record<string, unknown>[],
}));
vi.mock("../demo/store", () => ({ isDemoMode: () => false }));
vi.mock("./client", () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [state.row] }) }) }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          state.writes.push(values);
          Object.assign(state.row, values);
        },
      }),
    }),
  }),
}));
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
