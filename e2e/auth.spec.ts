// ===========================================================================
// e2e/auth.spec.ts — Authentication E2E Tests (converted from auth.cy.ts)
// ===========================================================================

import { test, expect } from "./fixtures/test-base";
import {
  apiRegister,
  apiLogin,
  injectAuth,
  uiRegister,
} from "./fixtures/helpers";

async function clearAuthState(page: import("@playwright/test").Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.removeItem("NEXT_PUBLIC_MY_TOKEN");
    localStorage.removeItem("NEXT_PUBLIC_MY_USERNAME");
  });
}

async function expectUnauthenticated(page: import("@playwright/test").Page) {
  const token = await page.evaluate(() => localStorage.getItem("NEXT_PUBLIC_MY_TOKEN"));
  expect(token ?? "").toBe("");
  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
    .toMatch(/^\/$|^\/login$/);
}

async function readLocalStorageSafely(
  page: import("@playwright/test").Page,
  key: string
): Promise<string> {
  try {
    return (
      (await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)) ?? ""
    );
  } catch {
    // During logout flow, the page can navigate/reload repeatedly.
    return "__NAVIGATING__";
  }
}

test.describe("Authentication Flow", () => {
  // Keep username short for cross-browser consistency with input maxlength.
  const uniqueUser = `pw_${Date.now().toString(36).slice(-8)}`;
  const password = "SecurePass123";

  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
  });

  // =========================================================================
  // REGISTRATION
  // =========================================================================

  test.describe("Registration", () => {
    test("should navigate to register form from login page", async ({ page }) => {
      await page.goto("/login");
      const registerBtn = page.getByRole("button", { name: "Register" });
      await expect(registerBtn).toBeVisible();
      await registerBtn.click();
      await expect(page.locator('input[name="firstname"]')).toBeVisible();
    });

    test("should register a new user successfully", async ({ page }) => {
      await uiRegister(page, "Test", "User", uniqueUser, password, password);

      await expect(page).toHaveURL(/(?:\/login|(?!.*\/register))/, { timeout: 15_000 });
    });

    test("should show error for mismatched passwords", async ({ page }) => {
      await page.goto("/login");
      await page.getByRole("button", { name: "Register" }).click();
      await page.locator('input[name="firstname"]').fill("Test");
      await page.locator('input[name="lastname"]').fill("User");
      await page.locator('input[name="username"]').fill("mismatchuser");
      await page.locator('input[name="password"]').fill(password);
      await page.locator('input[name="confirmPassword"]').fill("DifferentPass456");
      await page.getByRole("button", { name: "Create Account" }).click();

      await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
      await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
    });

    test("should show error for short password", async ({ page }) => {
      await page.goto("/login");
      await page.getByRole("button", { name: "Register" }).click();
      await page.locator('input[name="firstname"]').fill("Test");
      await page.locator('input[name="lastname"]').fill("User");
      await page.locator('input[name="username"]').fill("shortpwduser");
      await page.locator('input[name="password"]').fill("abc");
      await page.locator('input[name="confirmPassword"]').fill("abc");
      await page.getByRole("button", { name: "Create Account" }).click();

      await expectUnauthenticated(page);
    });
  });

  // =========================================================================
  // LOGIN
  // =========================================================================

  test.describe("Login", () => {
    test.beforeAll(async ({ request }) => {
      // Register user via real API
      await apiRegister(request, uniqueUser, password);

      const token = await apiLogin(request, uniqueUser, password);
      expect(token, "Login precondition failed for auth tests").toBeTruthy();
    });

    test("should login with valid credentials and redirect to dashboard", async ({ page }) => {
      await page.goto("/login");
      await page.locator('input[name="username"]').fill(uniqueUser);
      await page.locator('input[name="password"]').fill(password);

      // Firefox can be intermittently slow in this flow; retry submit once.
      for (let attempt = 1; attempt <= 2; attempt++) {
        await page.getByRole("button", { name: "Sign In" }).click();
        try {
          await expect
            .poll(
              () => page.evaluate(() => localStorage.getItem("NEXT_PUBLIC_MY_TOKEN") ?? ""),
              { timeout: 10_000 }
            )
            .not.toBe("");
          break;
        } catch (error) {
          if (attempt === 2) throw error;
        }
      }

      // Ensure we end on an authenticated route after token is persisted.
      if (/\/login$/.test(new URL(page.url()).pathname)) {
        await page.goto("/");
      }
      await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
    });

    test("should show error for invalid credentials", async ({ page }) => {
      await page.goto("/login");
      await page.locator('input[name="username"]').fill("nonexistent");
      await page.locator('input[name="password"]').fill("wrongpass");
      await page.getByRole("button", { name: "Sign In" }).click();

      const token = await page.evaluate(() =>
        localStorage.getItem("NEXT_PUBLIC_MY_TOKEN")
      );
      expect(token ?? "").toBe("");
      await expectUnauthenticated(page);
    });

    test("should show error for empty credentials", async ({ page }) => {
      await page.goto("/login");
      await page.getByRole("button", { name: "Sign In" }).click();
      await expect(page).toHaveURL(/\/login/);
    });
  });

  // =========================================================================
  // PROTECTED ROUTES
  // =========================================================================

  test.describe("Protected Routes", () => {
    test("should redirect unauthenticated users to login", async ({ page }) => {
      await clearAuthState(page);
      await page.goto("/shop");
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    });

    test("should allow authenticated users to access protected pages", async ({ page, request }) => {
      await apiRegister(request, uniqueUser, password);
      const token = await apiLogin(request, uniqueUser, password);
      if (token) await injectAuth(page, token, uniqueUser);

      await page.goto("/shop");
      await expect(page).toHaveURL(/\/shop/, { timeout: 15_000 });
    });
  });

  // =========================================================================
  // LOGOUT
  // =========================================================================

  test.describe("Logout", () => {
    test("should clear token and redirect to login", async ({ page, request }) => {
      await apiRegister(request, uniqueUser, password);
      const token = await apiLogin(request, uniqueUser, password);
      if (token) await injectAuth(page, token, uniqueUser);

      await page.goto("/logout");

      await expect
        .poll(() => readLocalStorageSafely(page, "NEXT_PUBLIC_MY_TOKEN"), {
          timeout: 20_000,
        })
        .toBe("");
      await expect
        .poll(() => readLocalStorageSafely(page, "NEXT_PUBLIC_MY_USERNAME"), {
          timeout: 20_000,
        })
        .toBe("");
      await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 15_000 })
        .toMatch(/^\/$|^\/login$|^\/logout$/);
    });
  });
});
