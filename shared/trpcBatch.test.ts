import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { initTRPC } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { expect, it } from "vitest";
import { TRPC_BATCH_LIMIT } from "./const";

it.each(["query", "mutation"] as const)("splits an admin-sized %s burst without losing results", async (kind) => {
  const t = initTRPC.create();
  const router = t.router({
    read: t.procedure.input((value: unknown) => Number(value)).query(({ input }) => input),
    write: t.procedure.input((value: unknown) => Number(value)).mutation(({ input }) => input),
  });
  const sizes: number[] = [];
  const client = createTRPCClient<typeof router>({
    links: [httpBatchLink({
      url: "https://example.test/api/trpc",
      maxItems: TRPC_BATCH_LIMIT,
      fetch: async (url, init) => {
        const request = new Request(url, init);
        sizes.push(new URL(request.url).pathname.split("/").pop()!.split(",").length);
        return fetchRequestHandler({
          endpoint: "/api/trpc", router, req: request,
          maxBatchSize: TRPC_BATCH_LIMIT,
          createContext: () => ({}),
        });
      },
    })],
  });
  const inputs = Array.from({ length: 27 }, (_, index) => index);
  const results = await Promise.all(inputs.map((input) =>
    kind === "query" ? client.read.query(input) : client.write.mutate(input),
  ));
  expect(results).toEqual(inputs);
  expect(sizes).toEqual([10, 10, 7]);
});
