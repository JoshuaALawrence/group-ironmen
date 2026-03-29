import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{js,ts}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      include: ["src/site/src/**/*.{js,ts}", "src/server/**/*.{js,ts}"],
      exclude: ["src/site/src/**/*.test.{js,ts}", "src/site/src/index.{js,ts}", "src/server/__tests__/**"],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
  },
});
