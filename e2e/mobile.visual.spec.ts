import { test, expect } from "./fixtures/test-base";
import { gotoRouteAndSettle, prepareMobilePage, stubMobileApis } from "./mobile.helpers";

test.describe("Mobile visual regression", () => {
  test.beforeEach(async ({ page }) => {
    await stubMobileApis(page);
    await prepareMobilePage(page);
  });

  test("dashboard route visual baseline", async ({ page }) => {
    await gotoRouteAndSettle(page, "/");
    await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId("dashboard-date")).toBeVisible();

    await expect(page).toHaveScreenshot("dashboard.png", {
      animations: "disabled",
      caret: "hide",
      mask: [page.getByTestId("dashboard-date")],
      maxDiffPixelRatio: 0.02,
    });
  });

  test("files route visual baseline", async ({ page }) => {
    await gotoRouteAndSettle(page, "/files");
    await expect(page.getByRole("button", { name: /^Files$/ })).toBeVisible();

    await expect(page).toHaveScreenshot("files.png", {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.02,
    });
  });

  test("shop route visual baseline", async ({ page }) => {
    await gotoRouteAndSettle(page, "/shop");
    await expect(page.getByRole("button", { name: "Store Items" })).toBeVisible();

    await expect(page).toHaveScreenshot("shop.png", {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.02,
    });
  });

  test("chat route visual baseline", async ({ page }) => {
    await gotoRouteAndSettle(page, "/chat");
    await expect(page.getByText("Community Rooms")).toBeVisible();

    await expect(page).toHaveScreenshot("chat.png", {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.02,
    });
  });
});
