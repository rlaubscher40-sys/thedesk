import { beforeEach, expect, it, vi } from "vitest";
import type { TrpcContext } from "../core/context";
const m = vi.hoisted(() => ({ create: vi.fn(), count: vi.fn().mockResolvedValue(4) }));
vi.mock("../db", () => ({ createFeedback: m.create, countNewFeedback: m.count }));
import { feedbackRouter } from "./feedback";
const guest = feedbackRouter.createCaller({ req: {}, res: {}, user: null } as TrpcContext);
beforeEach(() => vi.clearAllMocks());
it("removes private URL components on the server even for old clients", async () => {
  await guest.submit({
    kind: "bug",
    message: " A useful report ",
    pageUrl: "https://user:secret@thedesk.au/unsubscribe?token=private#private",
  });
  expect(m.create).toHaveBeenCalledWith(
    expect.objectContaining({
      message: "A useful report",
      pageUrl: "https://thedesk.au/unsubscribe",
    })
  );
});
it("rejects blank reports after trimming", async () => {
  await expect(guest.submit({ kind: "bug", message: "   " })).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
  expect(m.create).not.toHaveBeenCalled();
});
it("keeps private inbox counts behind the admin boundary", async () => {
  await expect(guest.newCount()).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(m.count).not.toHaveBeenCalled();
  const admin = feedbackRouter.createCaller({
    req: {},
    res: {},
    user: { id: 1, role: "admin" },
  } as TrpcContext);
  expect(await admin.newCount()).toEqual({ count: 4 });
});
