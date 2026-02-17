// ===========================================================================
// e2e/module-federation.spec.ts — Module Federation E2E Tests
//                                 (converted from module-federation.cy.ts)
// ===========================================================================

import { test, expect } from "./fixtures/test-base";
import { ensureLoggedIn, waitForPageLoad } from "./fixtures/helpers";

test.describe("Module Federation — Remote Loading", () => {
  test.beforeEach(async ({ authedPage: page, request }) => {
    await ensureLoggedIn(request, page);
  });

  async function verifyRemoteLoads(page: import("@playwright/test").Page, path: string, expectedContent: RegExp) {
    await page.goto(path);
    await page.waitForLoadState("domcontentloaded");
    await waitForPageLoad(page);

    // Ensure no load error
    const bodyText = await page.locator("body").textContent();
    if (bodyText?.includes("Module Load Error") || bodyText?.includes("Remote Module Unavailable")) {
      throw new Error(`Remote failed at ${path}`);
    }

    await expect(page.getByText(expectedContent).first()).toBeVisible({ timeout: 30_000 });
  }

  test("should load the shell app (dashboard)", async ({ authedPage: page }) => {
    await page.goto("/");
    await expect(page.locator("header")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: "CloudApp" })).toBeVisible();
  });

  test("should load the Shop page", async ({ authedPage: page }) => {
    await verifyRemoteLoads(page, "/shop", /item|product|shop|cart/i);
  });

  test("should load the Notes page", async ({ authedPage: page }) => {
    await verifyRemoteLoads(page, "/notes", /note/i);
  });

  test("should load the Files page", async ({ authedPage: page }) => {
    await verifyRemoteLoads(page, "/files", /file|upload/i);
  });

  test("should load the Chat page", async ({ authedPage: page }) => {
    await verifyRemoteLoads(page, "/chat", /chat|room|message/i);
  });

  test("should load the Jira remote module", async ({ authedPage: page }) => {
    await page.goto("/jira");
    await page.waitForLoadState("domcontentloaded");
    const bodyText = await page.locator("body").textContent();
    if (bodyText?.includes("Module Load Error")) throw new Error("Jira fail");
  });

  test("should load the Maps remote module", async ({ authedPage: page }) => {
    await page.goto("/maps");
    await page.waitForLoadState("domcontentloaded");
    const bodyText = await page.locator("body").textContent();
    if (bodyText?.includes("Module Load Error")) throw new Error("Maps fail");
  });

  test("should load the MLOps remote module", async ({ authedPage: page }) => {
    await page.goto("/mlops");
    await page.waitForLoadState("domcontentloaded");
    const bodyText = await page.locator("body").textContent();
    if (bodyText?.includes("Module Load Error")) throw new Error("MLOps fail");
  });

  test("should load the GPT/ChatLLM remote module", async ({ authedPage: page }) => {
    await page.goto("/chatllm");
    await page.waitForLoadState("domcontentloaded");
    const bodyText = await page.locator("body").textContent();
    if (bodyText?.includes("Module Load Error")) throw new Error("ChatLLM fail");
  });

  test("should load the PetStore remote module", async ({ authedPage: page }) => {
    await page.goto("/petstore");
    await page.waitForLoadState("domcontentloaded");
    const bodyText = await page.locator("body").textContent();
    if (bodyText?.includes("Module Load Error")) throw new Error("PetStore fail");
  });

  test("should show retry button when a remote fails", async ({ authedPage: page }) => {
    await page.goto("/maps");
    await page.waitForLoadState("domcontentloaded");
    const bodyText = await page.locator("body").textContent();
    if (bodyText?.includes("Module Load Error") || bodyText?.includes("Remote Module Unavailable")) {
      await expect(page.getByText("Retry")).toBeVisible();
    }
  });
});
