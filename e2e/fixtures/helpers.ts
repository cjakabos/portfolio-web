// ===========================================================================
// e2e/fixtures/helpers.ts — Shared helpers (replaces cypress/support/commands.ts)
//
// Provides API-level registration/login and localStorage injection.
// Used by global-setup.ts to create persistent auth state, and by
// individual tests for API-level operations.
// ===========================================================================

import { type Page, type APIRequestContext, expect } from "@playwright/test";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:80";

export const TEST_USER = {
  firstname: "E2E",
  lastname: "Tester",
  username: `e2e_${Date.now().toString(36).slice(-8)}`,
  password: "SecureE2EPass123",
};

// ---------------------------------------------------------------------------
// API helpers (bypass frontend — go directly to NGINX gateway)
// ---------------------------------------------------------------------------

export async function apiRegister(
  request: APIRequestContext,
  username: string,
  password: string
): Promise<boolean> {
  const resp = await request.post(`${BACKEND_URL}/cloudapp/user/user-register`, {
    data: {
      firstname: "E2E",
      lastname: "Tester",
      username,
      password,
      confirmPassword: password,
    },
    failOnStatusCode: false,
  });
  return resp.status() === 200;
}

export async function apiLogin(
  request: APIRequestContext,
  username: string,
  password: string
): Promise<string | null> {
  const resp = await request.post(`${BACKEND_URL}/cloudapp/user/user-login`, {
    data: { username, password },
    failOnStatusCode: false,
  });
  if (resp.status() === 200) {
    return resp.headers()["authorization"] || null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Page-level auth injection (sets localStorage so frontend sees user as
// logged in — equivalent to Cypress apiLogin command)
// ---------------------------------------------------------------------------

export async function injectAuth(page: Page, token: string, username: string) {
  // Navigate to a page first so localStorage is available on the right origin
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ token, username }) => {
      localStorage.setItem("NEXT_PUBLIC_MY_TOKEN", token);
      localStorage.setItem("NEXT_PUBLIC_MY_USERNAME", username);
    },
    { token, username }
  );
}

// ---------------------------------------------------------------------------
// Ensure the user is registered + logged in, return { token, username }
// ---------------------------------------------------------------------------

let cachedAuth: { token: string; username: string } | null = null;

export async function ensureLoggedIn(
  request: APIRequestContext,
  page: Page
): Promise<{ token: string; username: string }> {
  if (cachedAuth) {
    await injectAuth(page, cachedAuth.token, cachedAuth.username);
    return cachedAuth;
  }

  const username = TEST_USER.username;
  const password = TEST_USER.password;

  await apiRegister(request, username, password);
  const token = await apiLogin(request, username, password);
  if (!token) throw new Error("Failed to login test user");

  cachedAuth = { token, username };
  await injectAuth(page, token, username);
  return cachedAuth;
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  // Wait for spinners/loading indicators to disappear
  const loading = page.locator('[data-testid="loading"], .animate-spin, .loading');
  if ((await loading.count()) > 0) {
    await loading.first().waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
  }
}

export async function uiLogin(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

export async function uiRegister(
  page: Page,
  firstname: string,
  lastname: string,
  username: string,
  password: string,
  confirmPassword: string
) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Register" }).click();
  await page.locator('input[name="firstname"]').fill(firstname);
  await page.locator('input[name="lastname"]').fill(lastname);
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="confirmPassword"]').fill(confirmPassword);
  await page.getByRole("button", { name: "Create Account" }).click();
}
