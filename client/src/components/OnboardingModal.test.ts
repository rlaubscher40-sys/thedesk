import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import { OnboardingModal, PRODUCT_GUIDE_ACTIONS } from "./OnboardingModal";

describe("evidence-first arrival", () => {
  it("starts as an optional button, never an open onboarding dialog", () => {
    const html = renderToStaticMarkup(createElement(OnboardingModal));
    expect(html).toContain("How it works");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="dialog"');
  });
  it("guides users into current product surfaces without auto-running a paid question", () => {
    expect(PRODUCT_GUIDE_ACTIONS.map((action) => action.href)).toEqual([
      "/markets",
      "/ask",
      "/signals",
      "/",
    ]);
    expect(PRODUCT_GUIDE_ACTIONS.every((action) => !action.href.includes("?"))).toBe(true);
    expect(JSON.stringify(PRODUCT_GUIDE_ACTIONS)).not.toMatch(/admin|Substack|optimistic/);
  });
  it("does not mount automatic onboarding or subscription popups globally", () => {
    const app = fs.readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    expect(app).not.toMatch(/<OnboardingModal|<SubscribeModal/);
    const source = fs.readFileSync(new URL("./OnboardingModal.tsx", import.meta.url), "utf8");
    expect(source).not.toMatch(/localStorage|setTimeout/);
    const footer = fs.readFileSync(new URL("./desk/Footer.tsx", import.meta.url), "utf8");
    expect(footer).toContain("<OnboardingModal />");
  });
});
