import { expect, it, vi } from "vitest";
import { checkUptime } from "./uptime-check.mjs";
const healthy = () => new Response(JSON.stringify({ status: "ok", db: true }), { status: 200 });
it("does not let successful recording hide unhealthy or malformed health", async () => {
  for (const probe of [
    new Response("down", { status: 503 }),
    new Response("not-json", { status: 200 }),
    new Response(JSON.stringify({ status: "ok", db: false }), { status: 200 }),
  ]) {
    const fetcher = vi.fn().mockResolvedValueOnce(probe).mockResolvedValueOnce(new Response("ok"));
    expect(
      await checkUptime({ origin: "https://example.com", key: "test", fetcher })
    ).toMatchObject({ healthy: false, recorded: true, ok: false });
  }
});
it("requires both health and recording, keeps missing credentials and timeouts visible", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(healthy())
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  expect(await checkUptime({ origin: "https://example.com", key: "test", fetcher })).toMatchObject({
    ok: true,
  });
  expect(
    await checkUptime({
      origin: "https://example.com",
      fetcher: vi.fn().mockResolvedValue(healthy()),
    })
  ).toMatchObject({ healthy: true, recordingConfigured: false, ok: false });
  expect(
    await checkUptime({
      origin: "https://example.com",
      key: "test",
      fetcher: vi.fn().mockRejectedValue(new Error("timeout")),
    })
  ).toMatchObject({ httpStatus: 0, healthy: false, recorded: false, ok: false });
});
