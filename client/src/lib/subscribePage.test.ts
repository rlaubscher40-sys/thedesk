import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { describe, expect, it, vi } from "vitest";

vi.mock("./useSubscribe", () => ({
  hasSubscribed: () => true,
  useSubscribe: vi.fn(() => ({
    email: "",
    setEmail: vi.fn(),
    hp: "",
    setHp: vi.fn(),
    submit: vi.fn(),
    busy: false,
  })),
}));
import { SubscribeBand } from "../components/broadsheet/SubscribeBand";
import Subscribe from "../pages/Subscribe";
import { useSubscribe } from "./useSubscribe";

describe("explicit subscription recovery", () => {
  it("keeps the signup form available after a previous request, with the shared protected wiring", () => {
    const html = renderToStaticMarkup(
      createElement(Router, { ssrPath: "/subscribe" }, createElement(Subscribe))
    );
    expect(html).toContain('type="email"');
    expect(html).toContain('name="website"');
    expect(html).toContain("request a fresh confirmation email");
    expect(html).toContain("Requesting an email is not confirmation");
    expect(vi.mocked(useSubscribe).mock.calls.at(-1)?.[0].source).toBe("subscribe-page");
  });
  it("still hides passive signup pitches after a previous request", () => {
    expect(renderToStaticMarkup(createElement(SubscribeBand, { source: "market-file" }))).toBe("");
  });
});
