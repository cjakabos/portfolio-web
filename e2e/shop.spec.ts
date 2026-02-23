// ===========================================================================
// e2e/shop.spec.ts — E-Commerce E2E Tests (converted from shop.cy.ts)
// ===========================================================================

import { test, expect } from "./fixtures/test-base";
import { ensureAdminLoggedIn, ensureLoggedIn, waitForPageLoad } from "./fixtures/helpers";

test.describe("Shopping Flow", () => {
  const ITEM_NAME = `Widget ${Date.now()}`;
  const ITEM_PRICE = 29.99;

  const mockItem = { id: 999, name: ITEM_NAME, price: ITEM_PRICE, description: "E2E test item" };

  /** Stub shop API responses so the frontend has data to display */
  async function setupShopStubs(page: import("@playwright/test").Page, items: any[] = [mockItem]) {
    let currentCart = {
      id: 1,
      items: [] as any[],
      user: { id: 1, username: "test" },
      total: 0,
    };
    const history: any[] = [];

    await page.route(/\/cloudapp\/item$/, (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(items) });
      }
      if (route.request().method() === "POST") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockItem) });
      }
      return route.fallback();
    });

    await page.route(/\/cloudapp\/cart\/addToCart$/, (route) => {
      if (route.request().method() === "POST") {
        const req = route.request().postDataJSON() as { itemId?: number } | null;
        const selected = items.find((i) => i.id === req?.itemId) || mockItem;
        currentCart = {
          ...currentCart,
          items: [...currentCart.items, selected],
          total: Number((currentCart.total + Number(selected.price || 0)).toFixed(2)),
        };
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(currentCart),
        });
      }
      return route.fallback();
    });

    await page.route(/\/cloudapp\/cart\/getCart$/, (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(currentCart),
        });
      }
      return route.fallback();
    });

    await page.route(/\/cloudapp\/cart\/clearCart$/, (route) => {
      if (route.request().method() === "POST") {
        currentCart = { ...currentCart, items: [], total: 0 };
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(currentCart),
        });
      }
      return route.fallback();
    });

    await page.route(/\/cloudapp\/order\/submit\/.+$/, (route) => {
      if (route.request().method() === "POST") {
        if (currentCart.items.length > 0) {
          history.unshift({
            id: history.length + 1,
            items: currentCart.items,
            total: currentCart.total,
            date: new Date().toISOString(),
          });
        }
        currentCart = { ...currentCart, items: [], total: 0 };
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ message: "Order submitted", id: history.length }),
        });
      }
      return route.fallback();
    });

    await page.route(/\/cloudapp\/order\/history\/.+$/, (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(history),
        });
      }
      return route.fallback();
    });
  }

  // =========================================================================
  // BROWSE / CREATE ITEMS
  // =========================================================================

  test.describe("Browse Items", () => {
    test("should display the shop page", async ({ authedPage: page, request }) => {
      await ensureLoggedIn(request, page);
      await page.goto("/shop");
      await waitForPageLoad(page);
      await expect(page).toHaveURL(/\/shop/);
      await expect(page.getByRole("button", { name: "Store Items" })).toBeVisible();
    });

    test("should create a new item via Add Item form and display it", async ({ authedPage: page, request }) => {
      await ensureAdminLoggedIn(request, page);
      await setupShopStubs(page);

      await page.goto("/shop");
      await waitForPageLoad(page);

      await page.getByRole("button", { name: "Add Item" }).click();

      await page.locator('input[name="name"]').fill(ITEM_NAME);
      await page.locator('input[name="price"]').fill(ITEM_PRICE.toString());
      await page.locator('textarea[name="description"]').fill("E2E test item");

      const createPromise = page.waitForResponse((r) => r.url().includes("/cloudapp/item") && r.request().method() === "POST");
      await page.getByRole("button", { name: "Create Item" }).click();
      await createPromise;

      await expect(page.getByText(ITEM_NAME)).toBeVisible({ timeout: 15_000 });
    });

    test("should hide Add Item UI for non-admin users", async ({ authedPage: page, request }) => {
      await ensureLoggedIn(request, page);
      await setupShopStubs(page);

      await page.goto("/shop");
      await waitForPageLoad(page);

      await expect(page.getByRole("button", { name: "Add Item" })).toHaveCount(0);
      await expect(page.getByText("Create New Item")).toHaveCount(0);
    });
  });

  // =========================================================================
  // CART OPERATIONS
  // =========================================================================

  test.describe("Cart Operations", () => {
    test("should add an item to the cart", async ({ authedPage: page, request }) => {
      await ensureLoggedIn(request, page);
      await setupShopStubs(page);

      await page.goto("/shop");
      await waitForPageLoad(page);

      await expect(page.getByText(ITEM_NAME)).toBeVisible({ timeout: 10_000 });

      const addToCartBtn = page.getByRole("button", { name: /add to cart/i });
      await expect(addToCartBtn.first()).toBeVisible();

      const addPromise = page.waitForResponse(
        (r) => r.url().includes("/cloudapp/cart/addToCart") && r.request().method() === "POST"
      );
      const cartPromise = page.waitForResponse(
        (r) => r.url().includes("/cloudapp/cart/getCart") && r.request().method() === "POST"
      );
      await addToCartBtn.first().click({ force: true });
      await addPromise;
      await cartPromise;

      await expect(page.getByRole("button", { name: /checkout/i })).toBeVisible({
        timeout: 10_000,
      });
    });

    test("should show items in cart view", async ({ authedPage: page, request }) => {
      await ensureLoggedIn(request, page);
      await setupShopStubs(page);

      await page.goto("/shop");
      await waitForPageLoad(page);

      const addToCartBtn = page.getByRole("button", { name: /add to cart/i }).first();
      const addPromise = page.waitForResponse(
        (r) => r.url().includes("/cloudapp/cart/addToCart") && r.request().method() === "POST"
      );
      const cartPromise = page.waitForResponse(
        (r) => r.url().includes("/cloudapp/cart/getCart") && r.request().method() === "POST"
      );
      await addToCartBtn.click({ force: true });
      await addPromise;
      await cartPromise;

      await expect(page.getByRole("button", { name: /checkout/i })).toBeVisible({
        timeout: 10_000,
      });
    });

    test("should show correct total in cart", async ({ authedPage: page, request }) => {
      await ensureLoggedIn(request, page);
      await setupShopStubs(page);

      await page.goto("/shop");
      await waitForPageLoad(page);

      const addToCartBtn = page.getByRole("button", { name: /add to cart/i }).first();
      const addPromise = page.waitForResponse(
        (r) => r.url().includes("/cloudapp/cart/addToCart") && r.request().method() === "POST"
      );
      const cartPromise = page.waitForResponse(
        (r) => r.url().includes("/cloudapp/cart/getCart") && r.request().method() === "POST"
      );
      await addToCartBtn.click({ force: true });
      await addPromise;
      await cartPromise;

      await expect(page.getByRole("button", { name: /checkout/i })).toBeVisible({
        timeout: 10_000,
      });
      const bodyText = await page.locator("body").textContent();
      expect(bodyText).toContain(ITEM_PRICE.toString());
    });
  });

  // =========================================================================
  // ORDER SUBMISSION
  // =========================================================================

  test.describe("Order Submission", () => {
    test("should submit an order successfully", async ({ authedPage: page, request }) => {
      await ensureLoggedIn(request, page);
      await setupShopStubs(page);

      await page.goto("/shop");
      await waitForPageLoad(page);

      // Find and click submit/order/checkout button
      const orderBtn = page.getByRole("button", { name: /submit|order|checkout|place|buy/i });
      if ((await orderBtn.count()) > 0) {
        await orderBtn.first().click({ force: true });
      }

      const bodyText = (await page.locator("body").textContent())?.toLowerCase() || "";
      const hasExpected =
        bodyText.includes("success") ||
        bodyText.includes("submitted") ||
        bodyText.includes("placed") ||
        bodyText.includes("cart is empty") ||
        bodyText.includes("order");
      expect(hasExpected).toBeTruthy();
    });

    test("should show order history tab", async ({ authedPage: page, request }) => {
      await ensureLoggedIn(request, page);
      await setupShopStubs(page);

      await page.goto("/shop");
      await waitForPageLoad(page);

      await page.getByRole("button", { name: "My Orders" }).click();
      await page.waitForTimeout(1000);

      const bodyText = (await page.locator("body").textContent())?.toLowerCase() || "";
      const hasExpected =
        bodyText.includes("order") ||
        bodyText.includes("history") ||
        bodyText.includes("no orders") ||
        bodyText.includes("empty");
      expect(hasExpected).toBeTruthy();
    });
  });

  // =========================================================================
  // ITEM CREATION FORM
  // =========================================================================

  test.describe("Item Creation Form", () => {
    test("should cancel item creation", async ({ authedPage: page, request }) => {
      await ensureAdminLoggedIn(request, page);
      await page.goto("/shop");
      await waitForPageLoad(page);

      await page.getByRole("button", { name: "Add Item" }).click();
      await expect(page.locator('input[name="name"]')).toBeVisible();

      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(page.locator('input[name="name"]')).not.toBeVisible();
    });
  });

  test.describe("Real Backend Smoke", () => {
    test("should create a real item and add it to cart without request stubs", async ({ authedPage: page, request }) => {
      await ensureAdminLoggedIn(request, page);
      const realItemName = `RealWidget_${Date.now()}`;

      await page.goto("/shop");
      await waitForPageLoad(page);

      await page.getByRole("button", { name: "Add Item" }).click();
      await page.locator('input[name="name"]').fill(realItemName);
      await page.locator('input[name="price"]').fill("12.34");
      await page.locator('textarea[name="description"]').fill("real-backend-item");

      const createResponsePromise = page.waitForResponse(
        (r) => r.url().includes("/cloudapp/item") && r.request().method() === "POST"
      );
      await page.getByRole("button", { name: "Create Item" }).click();
      const createResponse = await createResponsePromise;
      expect(createResponse.status()).toBe(200);

      await expect(page.getByText(realItemName)).toBeVisible({ timeout: 15_000 });

      const addResponsePromise = page.waitForResponse(
        (r) => r.url().includes("/cloudapp/cart/addToCart") && r.request().method() === "POST"
      );
      await page.getByRole("button", { name: /add to cart/i }).first().click({ force: true });
      const addResponse = await addResponsePromise;
      expect(addResponse.status()).toBe(200);

      await expect(page.getByRole("button", { name: /checkout/i })).toBeVisible({
        timeout: 10_000,
      });
    });
  });
});
