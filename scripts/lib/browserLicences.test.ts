import { expect, it } from "vitest";
import { completeBrowserLicences } from "./browserLicences";

it("retains existing notices and fills only exact reviewed missing package versions", () => {
  const result = completeBrowserLicences(
    "# Licenses\n\n## react - 19 (MIT)\n\nOriginal notice\n\n## react-remove-scroll-bar - 2.3.8 (MIT)\n\n## wouter - 3.10.0 (Unlicense)\n\n"
  );
  expect(result).toContain("Original notice");
  expect(result).toContain("Copyright (c) 2025 Anton Korzunov");
  expect(result).toContain("This is free and unencumbered software");
});
it("fails on empty inventories and unknown or upgraded missing notices", () => {
  expect(() => completeBrowserLicences("# Licenses\n")).toThrow("empty");
  expect(() => completeBrowserLicences("## wouter - 3.11.0 (Unlicense)\n\n")).toThrow();
  expect(() => completeBrowserLicences("# Licenses\n\n## unknown - 1.0.0 (MIT)\n\n")).toThrow(
    "Missing"
  );
});
