// @vitest-environment happy-dom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { LoanRateScenario } from "./LoanRateScenario";
afterEach(cleanup);
it("compares repayments, handles zero interest, and clears misleading results for invalid input", () => {
  render(createElement(LoanRateScenario));
  expect(screen.getByRole("status").textContent).toContain("$3,079");
  expect(screen.getByRole("status").textContent).toContain("$81 more");
  fireEvent.change(screen.getByLabelText("Starting annual rate (%)"), { target: { value: "0" } });
  expect(screen.getByRole("status").textContent).toContain("$1,389");
  fireEvent.change(screen.getByLabelText("Loan balance ($)"), { target: { value: "" } });
  expect(screen.getByRole("status").textContent).toContain("Enter a balance");
  expect(screen.getByRole("status").textContent).not.toContain("Starting repayment");
  fireEvent.click(screen.getByRole("button", { name: "Restore example" }));
  expect(screen.getByRole("status").textContent).toContain("$81 more");
  fireEvent.change(screen.getByLabelText("Remaining term (years)"), { target: { value: "2.5" } });
  expect(screen.getByRole("status").textContent).toContain("whole remaining term");
});
