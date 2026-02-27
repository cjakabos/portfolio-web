// ===========================================================================
// e2e/global-setup.ts — Authentication Setup (runs once before all tests)
//
// Registers a test user via the API, injects the CloudApp auth cookie into the
// browser context, and saves the storage state to e2e/.auth/user.json.
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

  // Save the injected auth cookie state directly. Avoid booting the shell here:
  // in the E2E topology the frontend and gateway are cross-origin, so loading
  // "/" during setup triggers noisy auth-check requests that are irrelevant to
  // establishing browser auth state for downstream specs.
  await page.context().storageState({ path: authFile });
});
