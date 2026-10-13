import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "jira-authority.spec.ts",
  outputDir: "../test-results/jira-authority",
  workers: 1,
  retries: 0,
  use: { browserName: "chromium", serviceWorkers: "block" },
  reporter: [["list"], ["junit", { outputFile: "test-results/jira-authority/junit.xml" }]],
});
