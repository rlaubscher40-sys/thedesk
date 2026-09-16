// @vitest-environment happy-dom
import { createElement as h } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BarChart } from "./BarChart";
import { HeatTreemap } from "./HeatTreemap";

vi.mock("@/lib/category", () => ({ useCategoryColour: () => () => "#555555" }));
afterEach(cleanup);

it("does not leave chart marks transparent when lite/reduced-motion disables animation", () => {
  const { container } = render(
    h(
      "div",
      null,
      h(BarChart, {
        label: "Cadence",
        xLabels: ["#1"],
        series: [{ key: "signals", values: [3], colour: "#555" }],
      }),
      h(HeatTreemap, { data: [{ category: "PROPERTY", total: 3, daily: 2, weekly: 1 }] })
    )
  );
  const animated = container.querySelectorAll<SVGGElement>("svg g[style]");
  expect(animated.length).toBeGreaterThan(0);
  for (const mark of animated) {
    expect(mark.style.opacity).toBe("");
    expect(mark.style.animation).toContain("both");
  }
});

it("exposes every edition value through a native disclosure and labelled table", () => {
  render(
    h(BarChart, {
      label: "Edition cadence",
      xLabels: ["#1", "#2"],
      series: [
        { key: "signals", label: "Signals", values: [3, 0], colour: "#555" },
        { key: "topics", label: "Topics", values: [2], colour: "#333" },
      ],
    })
  );
  expect(screen.getByRole("img").getAttribute("aria-label")).toContain("View data");
  const summary = screen.getByText("View data: Edition cadence");
  expect(summary.tagName).toBe("SUMMARY");
  fireEvent.click(summary);
  const details = summary.parentElement as HTMLDetailsElement;
  expect(details.open).toBe(true);
  const table = screen.getByRole("table", { name: "Edition cadence" });
  expect(
    within(table)
      .getAllByRole("columnheader")
      .map((n) => n.textContent)
  ).toEqual(["Edition", "Signals", "Topics"]);
  expect(
    within(table)
      .getAllByRole("cell")
      .map((n) => n.textContent)
  ).toEqual(["3", "2", "0", "Not available"]);
});

it("preserves tiny categories and zero counts outside the visual tile layout", () => {
  const { container } = render(
    h(HeatTreemap, {
      data: [
        { category: "PROPERTY", total: 100, daily: 99, weekly: 1 },
        { category: "SCIENCE", total: 1, daily: 0, weekly: 1 },
        { category: "TECH", total: 0, daily: 0, weekly: 0 },
      ],
    })
  );
  fireEvent.click(screen.getByText("View data: Category coverage"));
  const table = screen.getByRole("table", { name: "Category coverage" });
  expect(
    within(table)
      .getAllByRole("rowheader")
      .map((n) => n.textContent)
  ).toEqual(["PROPERTY", "SCIENCE", "TECH"]);
  expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
});

it("handles an all-zero treemap without an infinite layout loop", () => {
  const { container } = render(
    h(HeatTreemap, { data: [{ category: "PROPERTY", total: 0, daily: 0, weekly: 0 }] })
  );
  expect(container.querySelectorAll("svg rect")).toHaveLength(0);
  expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
});
