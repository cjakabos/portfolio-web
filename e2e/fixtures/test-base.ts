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

import { test as base, expect, type Page, type Route } from "@playwright/test";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:80";

// Re-export expect so tests only need one import
export { expect };

export const test = base.extend<{
  authedPage: Page;
}>({
  page: async ({ page }, use) => {
    // --- API Proxy (equivalent to cypress/support/e2e.ts beforeEach) ------
    // Re-route /cloudapp/* and /mlops-segmentation/* requests that the
    // frontend sends to localhost → the actual NGINX gateway.
    await page.route(/\/(cloudapp|mlops-segmentation|petstore|vehicles)\//, async (route: Route) => {
      const url = new URL(route.request().url());
      // Replace origin with backend gateway
      const proxiedUrl = `${BACKEND_URL}${url.pathname}${url.search}`;
      try {
        const response = await route.fetch({ url: proxiedUrl });
        await route.fulfill({ response });
      } catch {
        // If backend is unreachable, let the request fail naturally
        await route.fallback();
      }
    });

    await use(page);
  },
  authedPage: async ({ page }, use) => {
    // Backward-compatible alias for existing tests.
    await use(page);
  },
});
