import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { SOCIAL_DESTINATIONS } from "@shared/socialDestinations";
vi.mock("@/lib/trpc", () => ({
  trpc: { instagram: { publishedStories: { useQuery: () => ({ data: [], isError: false }) } } },
}));
vi.mock("wouter", () => ({ useLocation: () => ["/", vi.fn()] }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
import { SocialStart } from "./SocialStart";
it("keeps every Reel reading destination visible even on the compact bio page", () => {
  for (const compact of [true, false]) {
    const html = renderToStaticMarkup(createElement(SocialStart, { compact }));
    for (const read of SOCIAL_DESTINATIONS) {
      const encodedLabel = renderToStaticMarkup(createElement("span", null, read.label))
        .replace(/^<span>|<\/span>$/g, "");
      expect(html).toContain(encodedLabel);
      expect(html).toContain(`href="${read.path}"`);
    }
    expect(html).toContain("All eight capital-city rent figures");
    expect(html).toContain("/social#capital-rents");
  }
});
