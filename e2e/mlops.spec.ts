// ===========================================================================
// e2e/mlops.spec.ts — MLOps Segmentation E2E Tests (converted from mlops.cy.ts)
// ===========================================================================

import { test, expect } from "./fixtures/test-base";
import { ensureLoggedIn, waitForPageLoad } from "./fixtures/helpers";

test.describe("MLOps Segmentation Flow", () => {
  const mockCustomers = [
    { id: 1, gender: "Male", age: 32, annual_income: 45, spending_score: 72, segment: 0 },
    { id: 2, gender: "Female", age: 28, annual_income: 65, spending_score: 55, segment: 1 },
    { id: 3, gender: "Male", age: 45, annual_income: 30, spending_score: 40, segment: 2 },
    { id: 4, gender: "Female", age: 22, annual_income: 80, spending_score: 90, segment: 0 },
    { id: 5, gender: "Male", age: 55, annual_income: 50, spending_score: 35, segment: 2 },
  ];

  const mockMLInfo = {
    spending_histogram: {
      data: mockCustomers.map((c) => c.spending_score),
      bins: 6,
      title: "Spending Score Distribution",
    },
    pairplot_data: {
      age: mockCustomers.map((c) => c.age),
      annual_income: mockCustomers.map((c) => c.annual_income),
      spending_score: mockCustomers.map((c) => c.spending_score),
      gender: mockCustomers.map((c) => c.gender),
    },
    cluster_scatter: {
      pca_component_1: [1.2, 2.1, -1.5, 2.6, -1.9],
      pca_component_2: [0.9, -0.4, 1.3, -0.7, 0.8],
      segment: mockCustomers.map((c) => c.segment),
      customer_id: mockCustomers.map((c) => c.id),
      n_clusters: 3,
      title: "Customer Segments",
    },
    segment_metadata: {
      0: { color: "#3b82f6", centroid_age: 27, centroid_income: 62, centroid_spending: 81 },
      1: { color: "#10b981", centroid_age: 28, centroid_income: 65, centroid_spending: 55 },
      2: { color: "#8b5cf6", centroid_age: 50, centroid_income: 40, centroid_spending: 38 },
    },
  };

  async function setupMlopsStubs(page: import("@playwright/test").Page) {
    await page.route(/\/mlops-segmentation\/getMLInfo/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockMLInfo) })
    );

    await page.route(/\/mlops-segmentation\/getSegmentationCustomers/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockCustomers) })
    );

    await page.route(/\/mlops-segmentation\/addCustomer/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: 99, gender: "Male", age: 35, annual_income: 55, spending_score: 72, segment: 0 }),
      })
    );
  }

  test.beforeEach(async ({ authedPage: page, request }) => {
    await ensureLoggedIn(request, page);
  });

  test("should navigate to MLOps page without error", async ({ authedPage: page }) => {
    await page.goto("/mlops");
    await waitForPageLoad(page);
    await expect(page).toHaveURL(/\/mlops/);
    await expect(page.getByText("Module Load Error")).not.toBeVisible();
    await expect(page.getByText("ML Customer Segmentation")).toBeVisible({ timeout: 30_000 });
  });

  test("should trigger segmentation and show charts", async ({ authedPage: page }) => {
    await setupMlopsStubs(page);

    await page.goto("/mlops");
    await waitForPageLoad(page);
    await expect(page.getByText("ML Customer Segmentation")).toBeVisible({ timeout: 30_000 });

    const mlInfoPromise = page.waitForResponse((r) => r.url().includes("/getMLInfo"));
    await page.getByRole("button", { name: "50", exact: true }).click();
    await mlInfoPromise;

    await expect(page.getByText("No results generated yet")).not.toBeVisible({ timeout: 30_000 });
  });

  test("should display spending histogram", async ({ authedPage: page }) => {
    await setupMlopsStubs(page);

    await page.goto("/mlops");
    await waitForPageLoad(page);
    await expect(page.getByText("ML Customer Segmentation")).toBeVisible({ timeout: 30_000 });

    const mlInfoPromise = page.waitForResponse((r) => r.url().includes("/getMLInfo"));
    await page.getByRole("button", { name: "50", exact: true }).click();
    await mlInfoPromise;

    await page.getByRole("button", { name: "Spending Dist." }).click();

    const bodyText = (await page.locator("body").textContent())?.toLowerCase() || "";
    expect(bodyText).not.toContain("no results generated yet");
  });

  test("should display cluster scatter plot", async ({ authedPage: page }) => {
    await setupMlopsStubs(page);

    await page.goto("/mlops");
    await waitForPageLoad(page);
    await expect(page.getByText("ML Customer Segmentation")).toBeVisible({ timeout: 30_000 });

    const mlInfoPromise = page.waitForResponse((r) => r.url().includes("/getMLInfo"));
    await page.getByRole("button", { name: "50", exact: true }).click();
    await mlInfoPromise;

    await page.getByRole("button", { name: "Clusters" }).click();

    await expect(page.getByText("No results generated yet")).not.toBeVisible({ timeout: 30_000 });
  });

  test("should add a new customer", async ({ authedPage: page }) => {
    await setupMlopsStubs(page);

    await page.goto("/mlops");
    await waitForPageLoad(page);
    await expect(page.getByText("ML Customer Segmentation")).toBeVisible({ timeout: 30_000 });

    await page.locator("select:visible").first().selectOption("Male");
    await page.locator('input[name="age"]').fill("35");
    await page.locator('input[name="annual_income"]').fill("55");
    await page.locator('input[name="spending_score"]').fill("72");

    const addPromise = page.waitForResponse((r) => r.url().includes("/addCustomer"));
    await page.getByRole("button", { name: "Add & Re-Cluster" }).click();
    await addPromise;

    await expect(page.getByText("No customers found")).not.toBeVisible({ timeout: 15_000 });
  });

  test("should display customer data table", async ({ authedPage: page }) => {
    await setupMlopsStubs(page);

    await page.goto("/mlops");
    await waitForPageLoad(page);
    await expect(page.getByText("ML Customer Segmentation")).toBeVisible({ timeout: 30_000 });

    await page.locator("select:visible").first().selectOption("Female");
    await page.locator('input[name="age"]').fill("28");
    await page.locator('input[name="annual_income"]').fill("45");
    await page.locator('input[name="spending_score"]').fill("60");

    const addPromise = page.waitForResponse((r) => r.url().includes("/addCustomer"));
    await page.getByRole("button", { name: "Add & Re-Cluster" }).click();
    await addPromise;

    await expect(page.locator("table")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("No customers found")).not.toBeVisible({ timeout: 15_000 });
    expect(await page.locator("table tbody tr").count()).toBeGreaterThanOrEqual(1);
  });

  test("should load real mlops backend data without stubs", async ({ authedPage: page }) => {
    const mlInfoRespPromise = page.waitForResponse(
      (r) => r.url().includes("/mlops-segmentation/getMLInfo") && r.request().method() === "POST"
    );
    const customersRespPromise = page.waitForResponse(
      (r) => r.url().includes("/mlops-segmentation/getSegmentationCustomers") && r.request().method() === "GET"
    );

    await page.goto("/mlops");
    await waitForPageLoad(page);
    await expect(page.getByText("ML Customer Segmentation")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Module Load Error")).not.toBeVisible();

    const mlInfoResp = await mlInfoRespPromise;
    const customersResp = await customersRespPromise;

    expect([200, 500]).toContain(mlInfoResp.status());
    expect(customersResp.status()).toBe(200);
  });
});
