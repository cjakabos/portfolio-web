import { type APIRequestContext, type Page } from "@playwright/test";
import { test, expect } from "./fixtures/test-base";

const NIGHTLY_AI_E2E = process.env.NIGHTLY_AI_E2E === "1";
const MONITOR_URL = process.env.MONITOR_URL || "http://localhost:5010";
const AI_BASE_URL = `${process.env.BACKEND_URL || "http://localhost:80"}/ai`;
const CHAT_MODEL = process.env.NIGHTLY_CHAT_MODEL || "qwen3:1.7b";
const RAG_MODEL = process.env.NIGHTLY_RAG_MODEL || CHAT_MODEL;
const EMBEDDING_MODEL = process.env.NIGHTLY_EMBEDDING_MODEL || "qwen3-embedding:4b";
const EMBEDDING_MODEL_BASE = EMBEDDING_MODEL.split(":")[0] || EMBEDDING_MODEL;
const MONITOR_USERNAME = process.env.PW_ADMIN_USERNAME || "cloudadmin";

function toBase64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createFakeAdminJwt(username: string): string {
  const header = toBase64UrlJson({ alg: "RS256", typ: "JWT" });
  const payload = toBase64UrlJson({
    iss: "cloudapp",
    sub: username,
    roles: ["ROLE_ADMIN", "ROLE_USER"],
    exp: 4_102_444_800, // Jan 1, 2100 UTC
  });
  return `Bearer ${header}.${payload}.nightly-signature`;
}

const MONITOR_TOKEN = createFakeAdminJwt(MONITOR_USERNAME);

interface CurrentModelSettings {
  chat_model: string;
  rag_model: string;
  embedding_model: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fetchCurrentModels(request: APIRequestContext): Promise<CurrentModelSettings> {
  const response = await request.get(`${AI_BASE_URL}/llm/current`, { failOnStatusCode: false });
  if (!response.ok()) {
    throw new Error(`Failed to read /llm/current: ${response.status()} ${await response.text()}`);
  }
  return response.json() as Promise<CurrentModelSettings>;
}

async function selectCompactModel(
  page: Page,
  selectorLabel: string,
  optionMatcher: string | RegExp
): Promise<void> {
  const selectorButton = page.locator(`button:has-text("${selectorLabel}:")`).first();
  await expect(selectorButton).toBeVisible({ timeout: 20_000 });
  await selectorButton.click();

  const optionButton = page.locator("div.absolute button").filter({ hasText: optionMatcher }).first();
  await expect(optionButton).toBeVisible({ timeout: 20_000 });
  await optionButton.click();
}

function navButton(page: Page, label: string) {
  return page.getByRole("navigation").getByRole("button", { name: label });
}

test.describe("Nightly AI Integration - Monitor", () => {
  test.skip(!NIGHTLY_AI_E2E, "Nightly AI integration tests are disabled");

  test("sets chat/rag/embedding models from UI and persists in backend", async ({ page, request }) => {
    test.setTimeout(240_000);

    await page.addInitScript(
      ({ token, username }) => {
        localStorage.setItem("AI_MONITOR_CLOUDAPP_TOKEN", token);
        localStorage.setItem("AI_MONITOR_CLOUDAPP_USERNAME", username);
      },
      { token: MONITOR_TOKEN, username: MONITOR_USERNAME }
    );

    try {
      await fetchCurrentModels(request);
    } catch (error) {
      test.skip(true, `Skipping monitor nightly: backend model API unavailable (${String(error)})`);
    }

    await page.goto(MONITOR_URL, { waitUntil: "domcontentloaded" });
    // "AI Monitor" appears in both desktop sidebar and mobile header in the DOM.
    // Use a unique interactive element instead to avoid strict-mode ambiguity.
    await expect(navButton(page, "Live Chat")).toBeVisible({
      timeout: 120_000,
    });

    await navButton(page, "Live Chat").click();
    await expect(page.getByRole("heading", { name: "AI Chat" })).toBeVisible({ timeout: 120_000 });

    const chatModelSelector = page.locator('button:has-text("Chat Model:")').first();
    const hasChatSelector = await chatModelSelector.isVisible({ timeout: 20_000 }).catch(() => false);
    if (!hasChatSelector) {
      const ollamaUnavailable = await page
        .getByText(/Cannot Connect to Ollama|No Models Available|No Embedding Models Found/i)
        .first()
        .isVisible()
        .catch(() => false);
      if (ollamaUnavailable) {
        test.skip(true, "Skipping monitor nightly: Ollama models unavailable in this Docker runtime");
      }
      test.skip(true, "Skipping monitor nightly: Chat Model selector not visible");
    }

    await selectCompactModel(page, "Chat Model", new RegExp(escapeRegExp(CHAT_MODEL), "i"));

    await expect
      .poll(async () => (await fetchCurrentModels(request)).chat_model, {
        timeout: 120_000,
      })
      .toBe(CHAT_MODEL);

    await navButton(page, "Documents (RAG)").click();
    await expect(page.getByRole("heading", { name: "Document Intelligence" })).toBeVisible({
      timeout: 120_000,
    });

    await selectCompactModel(
      page,
      "Embedding Model",
      new RegExp(escapeRegExp(EMBEDDING_MODEL_BASE), "i")
    );
    await selectCompactModel(page, "RAG Model", new RegExp(escapeRegExp(RAG_MODEL), "i"));

    await expect
      .poll(
        async () => {
          const current = await fetchCurrentModels(request);
          return `${current.rag_model}|${current.embedding_model}`;
        },
        { timeout: 120_000 }
      )
      .toBe(`${RAG_MODEL}|${EMBEDDING_MODEL}`);
  });
});
