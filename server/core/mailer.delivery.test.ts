import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { send, sendDailyBriefEmail } from "./mailer";
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "test-only");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const message = { to: "reader@example.com", subject: "Test", html: "<p>Test</p>" };
describe("email transport", () => {
  it("requires a provider receipt, not just HTTP success", async () => {
    for (const body of [{}, { id: "" }, { id: 123 }, { id: " " }]) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body)));
      expect((await send(message)).delivered).toBe(false);
    }
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: "email-123" })));
    expect(await send(message)).toEqual({ delivered: true, id: "email-123" });
  });
  it("bounds requests and does not automatically retry ambiguous failures", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("Timed out", "TimeoutError"));
    expect((await send(message)).delivered).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal);
  });
  it("keeps unsubscribe headers and a free-comparison return link in the daily email", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id: "email-123" })));
    await sendDailyBriefEmail({ ...message, name: "Reader", feedDate: "2026-09-08",
      siteUrl: "https://thedesk.au", unsubscribeUrl: "https://thedesk.au/api/unsubscribe?sig=test",
      items: [{ id: 9, title: "<script>unsafe</script>", category: "PROPERTY", summary: "Evidence" }] });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(body.html).toContain("/story/9");
    expect(body.html).not.toContain("<script>unsafe</script>");
    expect(body.html).toContain("/markets/compare/brisbane-vs-perth?utm_source=email");
    expect(body.text).toContain("/markets/compare/brisbane-vs-perth?utm_source=email");
    expect(body.text).toContain("Unsubscribe: https://thedesk.au/api/unsubscribe?sig=test");
  });
});
