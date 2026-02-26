// ===========================================================================
// e2e/fixtures/helpers.ts — Shared helpers (replaces cypress/support/commands.ts)
//
// Provides API-level registration/login and localStorage injection.
// Used by global-setup.ts to create persistent auth state, and by
// individual tests for API-level operations.
// ===========================================================================

import { type Page, type APIRequestContext, expect } from "@playwright/test";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:80";
const AUTH_RETRY_ATTEMPTS = Number(process.env.PW_AUTH_RETRY_ATTEMPTS || "12");
const AUTH_RETRY_DELAY_MS = Number(process.env.PW_AUTH_RETRY_DELAY_MS || "5000");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const TEST_USER = {
  firstname: "E2E",
  lastname: "Tester",
  username: `e2e_${Date.now().toString(36).slice(-8)}`,
  password: "SecureE2EPass123",
};

export const ADMIN_TEST_USER = {
  firstname: "Integration",
  lastname: "Admin",
  username: process.env.PW_ADMIN_USERNAME || "integrationadmin",
  password: process.env.PW_ADMIN_PASSWORD || "SecureE2EPass123",
};

type AdminCandidate = {
  username: string;
  password: string;
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const rawToken = token.replace(/^Bearer\s+/i, "").trim();
  const parts = rawToken.split(".");
  if (parts.length < 2) return null;

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function tokenHasRole(token: string | null, role: string): boolean {
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  const roles = payload?.roles;
  return Array.isArray(roles) && roles.includes(role);
}

function getAdminLoginCandidates(): AdminCandidate[] {
  const candidates: AdminCandidate[] = [];
  const configuredUsername = process.env.PW_ADMIN_USERNAME;
  const configuredPassword = process.env.PW_ADMIN_PASSWORD;

  if (configuredUsername && configuredPassword) {
    candidates.push({ username: configuredUsername, password: configuredPassword });
  }

  candidates.push(
    { username: "integrationadmin", password: "SecureE2EPass123" },
    { username: "cloudadmin", password: "cloudy" }
  );

  const seen = new Set<string>();
  return candidates.filter(({ username, password }) => {
    const key = `${username}\u0000${password}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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
    const headers = resp.headers();
    return headers["authorization"] || headers["Authorization"] || null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Page-level auth injection (sets localStorage so frontend sees user as
// logged in — equivalent to Cypress apiLogin command)
// ---------------------------------------------------------------------------

export async function injectAuth(page: Page, token: string, username: string) {
  const rawToken = token.replace(/^Bearer\s+/i, "").trim();
  const backendUrl = new URL(BACKEND_URL);

  await page.context().addCookies([
    {
      name: "CLOUDAPP_AUTH",
      value: rawToken,
      domain: backendUrl.hostname,
      path: "/cloudapp",
      httpOnly: true,
      secure: backendUrl.protocol === "https:",
      sameSite: "Lax",
    },
  ]);

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
let cachedAdminAuth: { token: string; username: string } | null = null;

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
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= AUTH_RETRY_ATTEMPTS; attempt++) {
    const registerOk = await apiRegister(request, username, password);
    const loginResp = await request.post(`${BACKEND_URL}/cloudapp/user/user-login`, {
      data: { username, password },
      failOnStatusCode: false,
    });
    const loginHeaders = loginResp.headers();
    const token = loginHeaders["authorization"] || loginHeaders["Authorization"] || null;

    if (loginResp.status() === 200 && token) {
      cachedAuth = { token, username };
      await injectAuth(page, token, username);
      return cachedAuth;
    }

    const bodySnippet = (await loginResp.text().catch(() => ""))
      .replace(/\s+/g, " ")
      .slice(0, 300);
    lastError =
      `registerOk=${registerOk} loginStatus=${loginResp.status()} ` +
      `hasAuthHeader=${Boolean(token)} body="${bodySnippet}"`;

    console.warn(
      `[pw][auth] attempt ${attempt}/${AUTH_RETRY_ATTEMPTS} failed: ${lastError}`
    );

    if (attempt < AUTH_RETRY_ATTEMPTS) {
      await sleep(AUTH_RETRY_DELAY_MS);
    }
  }

  throw new Error(`Failed to login test user after retries (${lastError || "no details"})`);
}

export async function ensureAdminLoggedIn(
  request: APIRequestContext,
  page: Page
): Promise<{ token: string; username: string }> {
  if (cachedAdminAuth) {
    await injectAuth(page, cachedAdminAuth.token, cachedAdminAuth.username);
    return cachedAdminAuth;
  }

  const candidates = getAdminLoginCandidates();
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= AUTH_RETRY_ATTEMPTS; attempt++) {
    for (const { username, password } of candidates) {
      const registerOk = await apiRegister(request, username, password);
      const loginResp = await request.post(`${BACKEND_URL}/cloudapp/user/user-login`, {
        data: { username, password },
        failOnStatusCode: false,
      });
      const loginHeaders = loginResp.headers();
      const token = loginHeaders["authorization"] || loginHeaders["Authorization"] || null;

      if (loginResp.status() === 200 && token && tokenHasRole(token, "ROLE_ADMIN")) {
        cachedAdminAuth = { token, username };
        await injectAuth(page, token, username);
        return cachedAdminAuth;
      }

      const bodySnippet = (await loginResp.text().catch(() => ""))
        .replace(/\s+/g, " ")
        .slice(0, 300);
      const hasAdminRole = tokenHasRole(token, "ROLE_ADMIN");
      lastError =
        `user=${username} registerOk=${registerOk} loginStatus=${loginResp.status()} ` +
        `hasAuthHeader=${Boolean(token)} hasAdminRole=${hasAdminRole} body="${bodySnippet}"`;

      if (loginResp.status() === 200 && token && !hasAdminRole) {
        console.warn(`[pw][auth-admin] candidate '${username}' logged in but is not admin`);
      }
    }

    console.warn(`[pw][auth-admin] attempt ${attempt}/${AUTH_RETRY_ATTEMPTS} failed: ${lastError}`);

    if (attempt < AUTH_RETRY_ATTEMPTS) {
      await sleep(AUTH_RETRY_DELAY_MS);
    }
  }

  throw new Error(`Failed to login admin test user after retries (${lastError || "no details"})`);
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
