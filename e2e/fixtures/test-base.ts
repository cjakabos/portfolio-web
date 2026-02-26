// ===========================================================================
// e2e/fixtures/test-base.ts — Extended Playwright test with API proxy
//
// Replaces cypress/support/e2e.ts global beforeEach proxy.
// In Docker, the frontend sends requests to http://localhost/cloudapp/...
// which doesn't resolve. This fixture re-routes those to the NGINX gateway.
//
// Usage in tests:
//   import { test, expect } from './fixtures/test-base';
// ===========================================================================

import {
  test as base,
  expect,
  type ConsoleMessage,
  type Page,
  type Request,
  type Route,
  type TestInfo,
} from "@playwright/test";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:80";
const LOG_BROWSER_CONSOLE = process.env.PW_LOG_BROWSER_CONSOLE !== "0";
const LOG_REQUEST_FAILURES = process.env.PW_LOG_REQUEST_FAILURES !== "0";

function buildLogPrefix(testInfo: TestInfo): string {
  return `[pw][${testInfo.project.name}][w${testInfo.workerIndex}][${testInfo.title}]`;
}

function formatConsoleMessage(message: ConsoleMessage): string {
  const location = message.location();
  if (!location.url) {
    return message.text();
  }

  return `${message.text()} (${location.url}:${location.lineNumber}:${location.columnNumber})`;
}

// Re-export expect so tests only need one import
export { expect };

export const test = base.extend<{
  authedPage: Page;
}>({
  page: async ({ page }, use, testInfo) => {
    const logPrefix = buildLogPrefix(testInfo);
    const onConsole = (message: ConsoleMessage) => {
      if (!LOG_BROWSER_CONSOLE) {
        return;
      }
      console.log(`${logPrefix} [browser:${message.type()}] ${formatConsoleMessage(message)}`);
    };
    const onPageError = (error: Error) => {
      console.error(`${logPrefix} [pageerror] ${error.stack || error.message}`);
    };
    const onRequestFailed = (request: Request) => {
      if (!LOG_REQUEST_FAILURES) {
        return;
      }
      const failureText = request.failure()?.errorText || "unknown";
      console.warn(
        `${logPrefix} [requestfailed] ${request.method()} ${request.url()} -> ${failureText}`
      );
    };

    page.on("console", onConsole);
    page.on("pageerror", onPageError);
    page.on("requestfailed", onRequestFailed);

    // --- API Proxy (equivalent to cypress/support/e2e.ts beforeEach) ------
    // Re-route /cloudapp/* and /mlops-segmentation/* requests that the
    // frontend sends to localhost → the actual NGINX gateway.
    await page.route(/^https?:\/\/[^/]+\/(?:cloudapp|mlops-segmentation|petstore|vehicles)\//, async (route: Route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      // Top-level API calls only. Anchored route matcher avoids catching
      // Next.js internals like /_next/data/.../petstore.json.
      const proxiedUrl = `${BACKEND_URL}${path}${url.search}`;
      try {
        const response = await route.fetch({ url: proxiedUrl });
        await route.fulfill({ response });
      } catch {
        // If backend is unreachable, let the request fail naturally
        await route.fallback();
      }
    });

    try {
      await use(page);
    } finally {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      page.off("requestfailed", onRequestFailed);
    }
  },
  authedPage: async ({ page }, use) => {
    // Backward-compatible alias for existing tests.
    await use(page);
  },
});
