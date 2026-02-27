import { type Page, type Route } from "@playwright/test";
import { test, expect } from "./fixtures/test-base";
import { ensureAdminLoggedIn } from "./fixtures/helpers";

const MONITOR_URL = process.env.MONITOR_URL || "http://localhost:5010";

function fulfillJson(route: Route, body: unknown, status = 200, headers?: Record<string, string>) {
  return route.fulfill({
    status,
    headers: {
      "content-type": "application/json",
      ...(headers || {}),
    },
    body: JSON.stringify(body),
  });
}

async function mockBaselineMonitorApis(page: Page): Promise<void> {
  await page.route("**/cloudapp/user/admin/auth-check", async (route) =>
    fulfillJson(route, {
      username: "integrationadmin",
      roles: ["ROLE_ADMIN", "ROLE_USER"],
    })
  );

  await page.route("**/ai/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith("/metrics")) {
      return fulfillJson(route, {
        totalRequests: 25,
        successRate: 99.2,
        avgLatency: 145,
        activeOrchestrations: 1,
        orchestrationTypes: [{ name: "conversational", value: 25 }],
        capabilityUsage: [],
        recentExecutions: [],
      });
    }

    if (path.endsWith("/circuit-breakers")) {
      return fulfillJson(route, {
        circuit_breakers: [],
        storage_backend: "memory",
        total_count: 0,
      });
    }

    if (path.endsWith("/approvals/pending")) {
      return fulfillJson(route, []);
    }

    if (path.endsWith("/experiments")) {
      return fulfillJson(route, []);
    }

    if (path.endsWith("/health")) {
      return fulfillJson(route, {
        status: "healthy",
        service: "ai-orchestration-layer",
      });
    }

    if (path.includes("/errors/summary")) {
      return fulfillJson(route, {
        total_errors: 0,
        by_category: {},
        by_severity: {},
        hours_analyzed: 24,
        error_handling_available: true,
      });
    }

    if (path.endsWith("/llm/models")) {
      return fulfillJson(route, {
        models: [{ name: "llama3.1:8b", model: "llama3.1:8b" }],
        total: 1,
        ollama_url: "http://ollama:11434",
        connected: true,
        error: null,
      });
    }

    if (path.endsWith("/llm/current")) {
      if (route.request().method() === "POST") {
        return fulfillJson(route, { status: "ok" });
      }
      return fulfillJson(route, {
        chat_model: "llama3.1:8b",
        rag_model: "llama3.1:8b",
        embedding_model: "nomic-embed-text",
        ollama_url: "http://ollama:11434",
      });
    }

    if (path.endsWith("/tools")) {
      return fulfillJson(route, { tools: [], total: 0, categories: [] });
    }

    return fulfillJson(route, {});
  });

  await page.route("**/cloudapp-admin/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith("/user/admin/users")) {
      return fulfillJson(route, ["alice"]);
    }

    if (path.endsWith("/item")) {
      return fulfillJson(route, [
        {
          id: 11,
          name: "Admin Item",
          description: "Admin-visible item",
          price: 19.99,
        },
      ]);
    }

    if (path.endsWith("/cart/getCart")) {
      return fulfillJson(route, {
        items: [],
        total: 0,
      });
    }

    if (path.includes("/order/history/")) {
      return fulfillJson(route, []);
    }

    if (path.includes("/note/user/")) {
      return fulfillJson(route, []);
    }

    return fulfillJson(route, {});
  });

  await page.route("**/petstore/**", (route) => fulfillJson(route, []));
  await page.route("**/vehicles/**", (route) => fulfillJson(route, []));
}

test.describe("AI Monitor", () => {
  test("loads Services Dashboard with admin user dropdown and scoped user fetch", async ({ page, request }) => {
    await ensureAdminLoggedIn(request, page);

    await mockBaselineMonitorApis(page);

    let usersAuthorizationHeader: string | undefined;
    let requestedCartUsername: string | undefined;

    await page.route("**/cloudapp-admin/user/admin/users", async (route) => {
      usersAuthorizationHeader = route.request().headers()["authorization"];
      return fulfillJson(route, ["alice", "bob"]);
    });

    await page.route("**/cloudapp-admin/cart/getCart", async (route) => {
      const body = route.request().postDataJSON() as { username?: string } | null;
      requestedCartUsername = body?.username;
      return fulfillJson(route, {
        // ServicesDashboard maps cart items from CloudApp shape: { id, name, price }.
        items: [{ id: 77, name: "Admin Cart Item", price: 40 }],
        total: 40,
      });
    });

    await page.goto(MONITOR_URL, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "All Services" }).click();

    await expect(page.getByText("Services Dashboard")).toBeVisible();
    await expect(page.getByText("Inspect User:")).toBeVisible();
    await expect(page.locator('select option[value="alice"]')).toHaveCount(1);
    await expect(page.locator('select option[value="bob"]')).toHaveCount(1);
    await expect(page.locator("select").first()).toHaveValue("alice");

    await page.getByRole("button", { name: "cart" }).click();
    await expect(page.getByText("Admin Cart Item")).toBeVisible();

    expect(usersAuthorizationHeader).toBeUndefined();
    expect(requestedCartUsername).toBe("alice");
  });

  test("retries tool discovery on 429 and invokes tool with auth + params", async ({ page, request }) => {
    await ensureAdminLoggedIn(request, page);

    await mockBaselineMonitorApis(page);

    let discoverToolsCalls = 0;
    const discoverToolsAuthHeaders: string[] = [];
    let invokeAuthHeader: string | undefined;
    let invokePayload: Record<string, unknown> | null = null;

    await page.route("**/ai/tools", async (route) => {
      if (route.request().method() !== "GET") {
        return route.fallback();
      }

      discoverToolsCalls += 1;
      discoverToolsAuthHeaders.push(route.request().headers()["authorization"] || "");

      if (discoverToolsCalls === 1) {
        return fulfillJson(route, { error: "throttled" }, 429, { "Retry-After": "0" });
      }

      return fulfillJson(route, {
        tools: [
          {
            name: "get_cart",
            description: "Fetch cloudapp cart for a username",
            category: "cloudapp",
            parameters: [
              {
                name: "username",
                type: "string",
                description: "CloudApp username",
                required: true,
              },
            ],
            examples: ['get_cart(username="alice")'],
          },
        ],
        total: 1,
        categories: ["cloudapp"],
      });
    });

    await page.route("**/ai/tools/get_cart/invoke", async (route) => {
      invokeAuthHeader = route.request().headers()["authorization"];
      invokePayload = route.request().postDataJSON() as Record<string, unknown>;
      return fulfillJson(route, {
        tool: "get_cart",
        success: true,
        result: {
          username: "bob",
          items: [{ itemId: 1, quantity: 1 }],
        },
        latency_ms: 12,
        error: null,
      });
    });

    await page.goto(MONITOR_URL, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Tools Explorer" }).click();

    await expect(page.getByRole("heading", { name: "Tools Explorer" })).toBeVisible();
    await expect(page.getByRole("button", { name: "cloudapp" })).toBeVisible();
    await page.getByRole("button", { name: "cloudapp" }).click();
    await expect(page.getByRole("button", { name: "get_cart" })).toBeVisible();
    await page.getByRole("button", { name: "get_cart" }).click();

    const usernameParamInput = page.locator('input[placeholder*="Enter string"]').last();
    await usernameParamInput.fill("bob");
    await page.getByRole("button", { name: "Invoke Tool" }).click();

    await expect(page.getByText("Success")).toBeVisible();
    await expect(page.getByText('"username": "bob"')).toBeVisible();

    expect(discoverToolsCalls).toBe(2);
    expect(discoverToolsAuthHeaders).toEqual(["", ""]);
    expect(invokeAuthHeader).toBeUndefined();
    expect((invokePayload?.parameters as { username?: string } | undefined)?.username).toBe("bob");
  });
});
