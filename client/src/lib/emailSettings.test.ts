import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NotificationsCard } from "../pages/Settings";
describe("email subscription controls", () => {
  it("offers a real signup recovery link and unsubscribe guidance instead of inactive switches", () => {
    const html = renderToStaticMarkup(createElement(NotificationsCard));
    expect(html).toContain('href="/subscribe"');
    expect(html).toContain("unsubscribe link at the bottom of any message");
    expect(html).not.toContain('role="switch"');
    expect(html).not.toContain("isn&#x27;t wired up");
  });
});
