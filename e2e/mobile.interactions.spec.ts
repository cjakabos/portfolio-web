import { test, expect } from "./fixtures/test-base";
import { gotoRouteAndSettle, prepareMobilePage, stubMobileApis } from "./mobile.helpers";

test.describe("Mobile interaction regression", () => {
  test.beforeEach(async ({ page }) => {
    await prepareMobilePage(page, 320, 900);
  });

  test("header nav and overflow menu are fully touch reachable", async ({ page }) => {
    await stubMobileApis(page);
    await gotoRouteAndSettle(page, "/");
    await expect(page.getByLabel("Home")).toBeVisible();

    await page.getByRole("link", { name: "Files & Notes", exact: true }).tap();
    await expect(page).toHaveURL(/\/files/);
    await expect(page.getByRole("button", { name: /^Files$/ })).toBeVisible();

    await page.getByRole("link", { name: "Shop", exact: true }).tap();
    await expect(page).toHaveURL(/\/shop/);
    await expect(page.getByRole("button", { name: "Store Items" })).toBeVisible();

    const overflowMenuButton = page.getByRole("button", {
      name: /Open more menu|Close more menu/,
    });
    await overflowMenuButton.tap();
    await expect(page.getByRole("menuitem", { name: "GPT", exact: true })).toBeVisible();
  });

  test("files mobile actions remain tappable and wired at 320px", async ({ page }) => {
    const state = await stubMobileApis(page);
    await gotoRouteAndSettle(page, "/files");
    await expect(page.getByRole("button", { name: /^Files$/ })).toBeVisible();

    await page.evaluate(() => {
      window.confirm = () => true;
    });

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(hasHorizontalOverflow).toBe(false);

    const downloadButton = page.getByRole("button", { name: /^Download/ }).first();
    const deleteButton = page.getByRole("button", { name: /^Delete/ }).first();
    await expect(downloadButton).toBeVisible();
    await expect(deleteButton).toBeVisible();

    const downloadBounds = await downloadButton.boundingBox();
    const deleteBounds = await deleteButton.boundingBox();
    expect(downloadBounds).not.toBeNull();
    expect(deleteBounds).not.toBeNull();
    expect(downloadBounds!.height).toBeGreaterThanOrEqual(44);
    expect(deleteBounds!.height).toBeGreaterThanOrEqual(44);

    await downloadButton.tap();
    await expect
      .poll(() => state.downloadCalls, { timeout: 5_000 })
      .toBe(1);

    await deleteButton.tap();
    await expect
      .poll(() => state.deleteCalls, { timeout: 5_000 })
      .toBe(1);
  });

  test("shop add-to-cart works with touch input on small screens", async ({ page }) => {
    const state = await stubMobileApis(page);
    await gotoRouteAndSettle(page, "/shop");
    await expect(page.getByRole("button", { name: "Store Items" })).toBeVisible();

    const addToCart = page.getByRole("button", { name: /Add to Cart/i }).first();
    await expect(addToCart).toBeVisible();
    await addToCart.tap();

    await expect
      .poll(() => state.addToCartCalls, { timeout: 5_000 })
      .toBe(1);
    await page.getByRole("button", { name: /Your Cart/i }).tap();
    await expect(page.getByRole("button", { name: /Checkout/i })).toBeVisible();
  });
});
