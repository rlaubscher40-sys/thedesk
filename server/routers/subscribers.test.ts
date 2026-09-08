import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../core/context";
import type { Subscriber } from "../db/schema";

const mocks = vi.hoisted(() => ({
  find: vi.fn(), create: vi.fn(), confirm: vi.fn(), mail: vi.fn(), already: vi.fn(), demo: vi.fn(), list: vi.fn(), feed: vi.fn(), daily: vi.fn(), mark: vi.fn(),
}));
vi.mock("../db", () => ({
  findSubscriberByEmail: mocks.find, createSubscriber: mocks.create, confirmSubscriber: mocks.confirm,
  listSubscribers: mocks.list, listFeedItems: mocks.feed, markDailyBriefSent: mocks.mark,
}));
vi.mock("../demo/store", () => ({ isDemoMode: mocks.demo }));
vi.mock("../core/mailer", () => ({
  sendConfirmEmail: mocks.mail, sendAlreadyConfirmedEmail: mocks.already,
  sendDailyBriefEmail: mocks.daily, editionUnsubscribeUrl: () => "https://thedesk.au/api/unsubscribe?sig=test",
}));
import { subscribersRouter } from "./subscribers";
const caller = subscribersRouter.createCaller({ req: {}, res: {}, user: null } as TrpcContext);
const input = { email: "reader@example.com" };
function subscriber(overrides: Partial<Subscriber> = {}): Subscriber {
  return { id: 1, email: input.email, confirmToken: "stored-token-123", confirmedAt: null,
    unsubscribedAt: null, ...overrides } as Subscriber;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("SITE_URL", "https://thedesk.au");
  mocks.demo.mockReturnValue(false);
  mocks.create.mockResolvedValue(subscriber());
  mocks.mail.mockResolvedValue({ delivered: true, id: "receipt" });
  mocks.already.mockResolvedValue({ delivered: true, id: "receipt" });
});
afterEach(() => vi.unstubAllEnvs());

describe("subscription email acceptance", () => {
  it("uses the persisted token and never exposes it to a production caller", async () => {
    expect(await caller.subscribe(input)).toEqual({ status: "pending-confirm", confirmToken: null });
    expect(mocks.mail).toHaveBeenCalledWith({ to: input.email,
      confirmUrl: "https://thedesk.au/confirm-subscription?token=stored-token-123" });
  });
  it("waits for the provider before completing signup", async () => {
    let accept!: (value: { delivered: true; id: string }) => void;
    mocks.mail.mockImplementation(() => new Promise((resolve) => { accept = resolve; }));
    let complete = false;
    const pending = caller.subscribe(input).then(() => { complete = true; });
    await vi.waitFor(() => expect(mocks.mail).toHaveBeenCalled());
    expect(complete).toBe(false);
    accept({ delivered: true, id: "receipt" });
    await pending;
    expect(complete).toBe(true);
  });
  it.each(["no-key", "api-error"])("does not report success for %s", async (reason) => {
    mocks.mail.mockResolvedValue({ delivered: false, reason, detail: "private provider details" });
    await expect(caller.subscribe(input)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR",
      message: "We couldn't send your email. Please try again in a minute." });
  });
  it("handles a thrown provider error without exposing its details", async () => {
    mocks.mail.mockRejectedValue(new Error("private provider details"));
    await expect(caller.subscribe(input)).rejects.toMatchObject({
      message: "We couldn't send your email. Please try again in a minute." });
  });
  it("keeps active and new addresses indistinguishable on success and failure", async () => {
    const fresh = await caller.subscribe(input);
    mocks.find.mockResolvedValue(subscriber({ confirmedAt: new Date() }));
    expect(await caller.subscribe(input)).toEqual(fresh);
    mocks.already.mockResolvedValue({ delivered: false, reason: "api-error" });
    await expect(caller.subscribe(input)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR", message: "We couldn't send your email. Please try again in a minute." });
  });
  it("does not send a dead confirmation link if persistence fails", async () => {
    mocks.create.mockResolvedValue(undefined);
    await expect(caller.subscribe(input)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(mocks.mail).not.toHaveBeenCalled();
  });
  it("requires a new confirmation for a previously unsubscribed address", async () => {
    mocks.find.mockResolvedValue(subscriber({ confirmedAt: new Date(), unsubscribedAt: new Date() }));
    await caller.subscribe(input);
    expect(mocks.create).toHaveBeenCalled();
    expect(mocks.mail).toHaveBeenCalled();
    expect(mocks.already).not.toHaveBeenCalled();
  });
  it("supports a local no-key demo without treating provider failures as success", async () => {
    mocks.demo.mockReturnValue(true);
    mocks.mail.mockResolvedValue({ delivered: false, reason: "no-key" });
    expect((await caller.subscribe(input)).confirmToken).toBe("stored-token-123");
    mocks.mail.mockResolvedValue({ delivered: false, reason: "api-error" });
    await expect(caller.subscribe(input)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
  it("rejects honeypot submissions before email or database work", async () => {
    await expect(caller.subscribe({ ...input, _hp: "spam" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.mail).not.toHaveBeenCalled();
  });
});


describe("admin brief delivery status", () => {
  const admin = subscribersRouter.createCaller({ req: {}, res: {}, user: { role: "admin" } } as TrpcContext);
  beforeEach(() => {
    mocks.list.mockResolvedValue([subscriber({ confirmedAt: new Date() })]);
    mocks.feed.mockResolvedValue([{ id: 1, title: "Property evidence", channel: "PROPERTY" }]);
  });
  it("reports a provider rejection and leaves the send marker unchanged", async () => {
    mocks.daily.mockResolvedValue({ delivered: false, reason: "api-error" });
    await expect(admin.resendDailyBrief({ subscriberId: 1 })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(mocks.mark).not.toHaveBeenCalled();
  });
  it("marks only an accepted email", async () => {
    mocks.daily.mockResolvedValue({ delivered: true, id: "receipt" });
    expect(await admin.resendDailyBrief({ subscriberId: 1 })).toEqual({ delivered: true });
    expect(mocks.mark).toHaveBeenCalledWith([1], expect.any(String));
  });
  it("rejects unconfirmed and unsubscribed recipients without sending", async () => {
    for (const sub of [subscriber(), subscriber({ confirmedAt: new Date(), unsubscribedAt: new Date() })]) {
      mocks.list.mockResolvedValue([sub]);
      await expect(admin.resendDailyBrief({ subscriberId: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    expect(mocks.daily).not.toHaveBeenCalled();
  });
});
