// ===========================================================================
// e2e/global-setup.ts — Authentication Setup (runs once before all tests)
//
// Registers a test user via the API, logs in, injects the token into
// localStorage, and saves the browser storage state to e2e/.auth/user.json.
// All test projects that depend on "setup" will reuse this state.
// ===========================================================================

import { test as setup, expect } from "@playwright/test";
import { ensureLoggedIn } from "./fixtures/helpers";

const authFile = "e2e/.auth/user.json";
const LOG_BROWSER_CONSOLE = process.env.PW_LOG_BROWSER_CONSOLE !== "0";
const LOG_REQUEST_FAILURES = process.env.PW_LOG_REQUEST_FAILURES !== "0";

setup("authenticate", async ({ page, request }) => {
  const logPrefix = "[pw][setup][authenticate]";
  page.on("console", (message) => {
    if (!LOG_BROWSER_CONSOLE) {
      return;
    }
    console.log(`${logPrefix} [browser:${message.type()}] ${message.text()}`);
  });
  page.on("pageerror", (error) => {
    console.error(`${logPrefix} [pageerror] ${error.stack || error.message}`);
  });
  page.on("requestfailed", (failedRequest) => {
    if (!LOG_REQUEST_FAILURES) {
      return;
    }
    const failureText = failedRequest.failure()?.errorText || "unknown";
    console.warn(
      `${logPrefix} [requestfailed] ${failedRequest.method()} ${failedRequest.url()} -> ${failureText}`
    );
  });

  const auth = await ensureLoggedIn(request, page);
  expect(auth.token, "Login should return a JWT token").toBeTruthy();

  // Verify we're no longer on the login page
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");

  // Save storage state for reuse by all test projects
  await page.context().storageState({ path: authFile });
});
