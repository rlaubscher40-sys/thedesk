// @vitest-environment happy-dom
import { createElement as h } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PrivacyChoices } from "./PrivacyChoices";
import { setOptionalMeasurement } from "@/lib/privacyPreferences";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setOptionalMeasurement(true);
  localStorage.clear();
});

it("exposes an accessible working measurement choice and privacy request contact", () => {
  render(h(PrivacyChoices));
  const choice = screen.getByRole("checkbox", {
    name: "Allow optional site measurements",
  }) as HTMLInputElement;
  expect(choice.checked).toBe(true);
  fireEvent.click(choice);
  expect(choice.checked).toBe(false);
  expect(screen.getByRole("status").textContent).toContain("Saved. Optional measurements are off.");
  expect(screen.getByRole("link", { name: "ruben@thedesk.au" }).getAttribute("href")).toBe(
    "mailto:ruben@thedesk.au?subject=Privacy%20request"
  );
});

it("explains browser privacy and never allows the checkbox to override it", () => {
  vi.stubGlobal("navigator", { globalPrivacyControl: true });
  render(h(PrivacyChoices));
  const choice = screen.getByRole("checkbox") as HTMLInputElement;
  expect(choice.checked).toBe(false);
  expect(choice.disabled).toBe(true);
  expect(screen.getByRole("status").textContent).toContain("Global Privacy Control");
});
