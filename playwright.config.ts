// ===========================================================================
// playwright.config.ts — Playwright E2E Configuration
//
// Supports TWO modes:
//
//   1. LOCAL (headed, in your browser):
//      npx playwright test --headed
//      npx playwright test --ui          ← interactive UI mode
//      npx playwright test --debug       ← step-through debugger
//
//   2. DOCKER (headless CI):
//      docker compose -f docker-compose.test.yml up --build test-e2e
//
// Environment variables:
//   BASE_URL     — shell frontend URL    (default: http://localhost:5001)
//   BACKEND_URL  — nginx gateway URL     (default: http://localhost:80)
//   CI           — set in Docker/CI to disable retries/traces on first run
// ===========================================================================

import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const baseURL = process.env.BASE_URL || "http://localhost:5001";
const backendURL = process.env.BACKEND_URL || "http://localhost:80";
const showcaseProfile = process.env.SHOWCASE_E2E_PROFILE || "extended";
const mobileSpecPattern = /mobile\.(visual|interactions)\.spec\.ts/;
const extendedOnlySpecPatterns = [
  /mlops\.spec\.ts/,
  /module-federation\.spec\.ts/,
  /monitor\.spec\.ts/,
  /nightly-.*\.spec\.ts/,
];
const desktopTestIgnore =
  showcaseProfile === "core"
    ? [mobileSpecPattern, ...extendedOnlySpecPatterns]
    : mobileSpecPattern;

export default defineConfig({
  testDir: "./e2e",
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}",
  fullyParallel: false, // tests share auth state — run sequentially
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },

  reporter: isCI
    ? [["line"], ["html", { open: "never" }], ["junit", { outputFile: "results/junit.xml" }]]
    : [["list"], ["html", { open: "on-failure" }]],

  use: {
    baseURL,
    trace: isCI ? "on-first-retry" : "retain-on-failure",
    screenshot: "only-on-failure",
    video: isCI ? "retain-on-failure" : "off",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,

    // Custom env passed to all tests via testInfo or direct import
    extraHTTPHeaders: {},
  },

  projects: [
    // --- Setup: register + login, save auth state -------------------------
    {
      name: "setup",
      testMatch: /global-setup\.ts/,
    },

    // --- Chromium (default) -----------------------------------------------
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
      testIgnore: desktopTestIgnore,
    },

    // --- Firefox (opt-in: npx playwright test --project=firefox) ----------
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
      testIgnore: desktopTestIgnore,
    },

    // --- WebKit (opt-in) --------------------------------------------------
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
      testIgnore: desktopTestIgnore,
    },

    // --- Mobile Chromium visual + interaction regression -------------------
    {
      name: "mobile-chromium",
      testMatch: mobileSpecPattern,
      use: {
        ...devices["Pixel 7"],
      },
    },
  ],

  // Local dev: auto-start the shell if not running
  // Comment out or remove for Docker where services are started separately
  ...(isCI
    ? {}
    : {
        // webServer: {
        //   command: 'npm run dev',
        //   url: baseURL,
        //   reuseExistingServer: true,
        //   timeout: 120_000,
        // },
      }),
});
