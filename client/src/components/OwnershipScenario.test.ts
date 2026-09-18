// @vitest-environment happy-dom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { OwnershipScenario } from "./OwnershipScenario";

afterEach(cleanup);

it("shows the worked example, its cash flow and the principal separated out", () => {
  render(createElement(OwnershipScenario));
  const status = screen.getByRole("status").textContent ?? "";
  // 50 of 52 weeks let at $650 = $32,500 collected.
  expect(status).toContain("$32,500");
  expect(status).toContain("50 of 52 weeks let");
  // Loan side: $43,168 of repayments, $35,800 interest, $7,368 principal.
  expect(status).toContain("$43,168");
  expect(status).toContain("$35,800 interest");
  expect(status).toContain("$7,368 principal");
  // Out of pocket for the year, and the same figure with principal added back.
  expect(status).toContain("−$18,943");
  expect(status).toContain("−$11,575");
  expect(status).toContain("moved into equity");
  expect(status).toContain("not a return");
});

it("withholds every result while an entry is missing or out of range", () => {
  render(createElement(OwnershipScenario));
  fireEvent.change(screen.getByLabelText(/Rent when let/), { target: { value: "" } });
  const status = screen.getByRole("status").textContent ?? "";
  expect(status).toContain("Fill in every field");
  expect(status).not.toContain("$32,500");
  expect(screen.queryByText("If it went worse")).toBeNull();

  fireEvent.change(screen.getByLabelText(/Rent when let/), { target: { value: "650" } });
  fireEvent.change(screen.getByLabelText(/Remaining term/), { target: { value: "25.5" } });
  expect(screen.getByRole("status").textContent).toContain("Fill in every field");
  fireEvent.change(screen.getByLabelText(/Vacant weeks/), { target: { value: "60" } });
  expect(screen.getByRole("status").textContent).toContain("Fill in every field");
});

it("recalculates from the reader's own entries and restores the example", () => {
  render(createElement(OwnershipScenario));
  fireEvent.change(screen.getByLabelText(/Vacant weeks/), { target: { value: "0" } });
  // 52 weeks at $650 = $33,800.
  expect(screen.getByRole("status").textContent).toContain("$33,800");
  fireEvent.click(screen.getByRole("button", { name: "Restore the worked example" }));
  expect(screen.getByRole("status").textContent).toContain("$32,500");
});

it("shows fixed downside shifts as what-ifs, never as predictions", () => {
  render(createElement(OwnershipScenario));
  expect(screen.getByText("If it went worse")).toBeTruthy();
  expect(screen.getByText(/not probabilities and not predictions/)).toBeTruthy();
  const rows = screen.getAllByRole("row");
  const combined = rows.find((row) => row.textContent?.includes("All three at once"))!;
  expect(combined.textContent).toContain("Not a prediction");
  // A 10% rent cut costs $3,250 gross, $3,022.50 after the fee no longer charged.
  const rent = rows.find((row) => row.textContent?.includes("Rent 10% lower"))!;
  expect(rent.textContent).toContain("−$3,023");
});

it("states that it is pre-tax and points at records rather than rating an address", () => {
  render(createElement(OwnershipScenario));
  expect(screen.getByText(/Hypothetical ownership scenario · Pre-tax/)).toBeTruthy();
  expect(
    screen.getByText(/does not rate an address, price a risk or quote insurance/)
  ).toBeTruthy();
  expect(screen.getByText(/not a safety rating for one address/)).toBeTruthy();
  expect(
    screen.getByRole("link", { name: /NSW Planning Portal Spatial Viewer/ }).getAttribute("href")
  ).toBe("https://www.planningportal.nsw.gov.au/spatialviewer/");
  expect(screen.getByText(/no negative gearing, no depreciation/)).toBeTruthy();
});

it("labels and describes every input for assistive technology", () => {
  render(createElement(OwnershipScenario));
  for (const label of [
    /Loan balance/,
    /Annual interest rate/,
    /Remaining term/,
    /Rent when let/,
    /Vacant weeks/,
    /Management fee/,
    /Council rates/,
    /Insurance/,
    /Maintenance and repairs/,
    /Strata or body corporate/,
  ]) {
    const input = screen.getByLabelText(label);
    expect(input.getAttribute("aria-describedby")).toContain("ownership-result");
    expect(input.getAttribute("min")).not.toBeNull();
    expect(input.getAttribute("max")).not.toBeNull();
  }
});
