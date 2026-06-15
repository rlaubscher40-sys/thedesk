import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  test: {
    environment: "node",
    // The OG-image tests (server/og/*.test.ts) render real JPEGs via
    // satori + resvg + sharp, including font loading. Each takes 1-3s locally
    // and more on a cold CI runner, which blows past vitest's default 5s
    // per-test timeout. Give every test a generous ceiling so these legitimate
    // long-runners don't flake CI; the job-level timeout (15m) is the real guard.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: [
      "server/**/*.test.ts",
      "shared/**/*.test.ts",
      "client/src/**/*.test.ts",
      "scripts/**/*.test.ts",
    ],
  },
});
