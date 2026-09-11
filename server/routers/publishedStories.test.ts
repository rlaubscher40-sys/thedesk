import { expect, it, vi } from "vitest";
import type { TrpcContext } from "../core/context";
vi.mock("../instagram/publishedStories", () => ({ publishedSocialStories: async () => [] }));
import { instagramRouter } from "./instagram";
it("allows anonymous reading links while keeping metrics and publishing admin-only", async () => {
  const caller = instagramRouter.createCaller({ req: {}, res: {}, user: null } as TrpcContext);
  expect(await caller.publishedStories()).toEqual([]);
  await expect(caller.listAll()).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(caller.publicationAudit()).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(caller.publishingStatus()).rejects.toMatchObject({ code: "FORBIDDEN" });
});
