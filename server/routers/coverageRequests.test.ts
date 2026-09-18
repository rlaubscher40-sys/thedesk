import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../core/context";

const m = vi.hoisted(() => ({ create: vi.fn(), outcome: vi.fn() }));
vi.mock("../db", () => ({ createFeedback: m.create, recordRequestOutcome: m.outcome }));

import { feedbackRouter } from "./feedback";

const guest = feedbackRouter.createCaller({ req: {}, res: {}, user: null } as TrpcContext);
const admin = feedbackRouter.createCaller({
  req: {},
  res: {},
  user: { id: 1, role: "admin" },
} as TrpcContext);

beforeEach(() => vi.clearAllMocks());

describe("submitting a coverage request", () => {
  it("stores the three fixed categories alongside the message", async () => {
    await guest.submit({
      kind: "coverage",
      message: "Is anything actually being built in Parramatta?",
      topic: "supply",
      geography: "nsw",
      readerTask: "buying",
    });
    expect(m.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "coverage",
        message: "Is anything actually being built in Parramatta?",
        topic: "supply",
        geography: "nsw",
        readerTask: "buying",
      })
    );
  });

  it("refuses a category it does not publish, rather than storing free text", async () => {
    for (const patch of [
      { topic: "whatever" },
      { geography: "Sydney, 12 Smith St" },
      { readerTask: "selling" },
    ])
      await expect(
        guest.submit({ kind: "coverage", message: "A request", ...patch } as never)
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(m.create).not.toHaveBeenCalled();
  });

  it("does not let a bug report become a coverage request by sending categories", async () => {
    await guest.submit({
      kind: "bug",
      message: "The chart is broken",
      topic: "supply",
      geography: "nsw",
      readerTask: "buying",
    });
    expect(m.create).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "bug", topic: null, geography: null, readerTask: null })
    );
  });
});

describe("recording an outcome", () => {
  it("is admin-only", async () => {
    await expect(guest.setRequestOutcome({ id: 1, status: "reviewed" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(m.outcome).not.toHaveBeenCalled();
  });

  it("links a published Desk page to the request that prompted it", async () => {
    expect(
      await admin.setRequestOutcome({ id: 7, status: "answered", answerUrl: "/story/1234" })
    ).toEqual({
      ok: true,
    });
    expect(m.outcome).toHaveBeenCalledWith(7, "answered", "/story/1234");
  });

  it("refuses to store an answer that is not a Desk published page", async () => {
    for (const answerUrl of [
      "https://evil.example",
      "//evil.example",
      "/admin",
      "/story/1234?next=https://evil.example",
      undefined,
      null,
    ])
      await expect(
        admin.setRequestOutcome({ id: 7, status: "answered", answerUrl })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(m.outcome).not.toHaveBeenCalled();
  });

  it("clears any link when the request is not answered", async () => {
    for (const status of ["new", "reviewed", "declined"] as const) {
      await admin.setRequestOutcome({ id: 7, status, answerUrl: "/story/1234" });
      expect(m.outcome).toHaveBeenLastCalledWith(7, status, null);
    }
  });
});
