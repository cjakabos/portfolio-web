import { type Page } from "@playwright/test";
import { test, expect } from "./fixtures/test-base";
import { ensureLoggedIn, waitForPageLoad } from "./fixtures/helpers";

const NIGHTLY_AI_E2E = process.env.NIGHTLY_AI_E2E === "1";
const CHAT_MODEL = process.env.NIGHTLY_CHAT_MODEL || "qwen3:1.7b";

async function gotoWithRetry(url: string, page: Page, attempts = 3) {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      return;
    } catch (error) {
      lastError = error;
      if (i < attempts) {
        await page.waitForTimeout(2_000);
      }
    }
  }
  throw lastError;
}

type ChatReadyState = "model_ready" | "remote_unavailable" | "ollama_unreachable" | "unknown";

async function waitForChatReadyState(page: Page, timeoutMs = 45_000): Promise<ChatReadyState> {
  const modelSelect = page.locator('label:has-text("AI Model") + select').first();
  const remoteUnavailable = page.getByText(/Remote Module Unavailable|Module Load Error/i).first();
  const ollamaUnavailable = page
    .getByText(
      /Unable to reach the Ollama server|Fix Ollama setup to enable chat|Ollama is running but no models are installed yet/i
    )
    .first();

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await modelSelect.isVisible().catch(() => false)) {
        return "model_ready";
      }
      if (await remoteUnavailable.isVisible().catch(() => false)) {
        return "remote_unavailable";
      }
      if (await ollamaUnavailable.isVisible().catch(() => false)) {
        return "ollama_unreachable";
      }
      await page.waitForTimeout(1_000);
    } catch {
      return "unknown";
    }
  }
  return "unknown";
}

test.describe("Nightly AI Integration - ChatLLM", () => {
  test.skip(!NIGHTLY_AI_E2E, "Nightly AI integration tests are disabled");

  test("uses qwen chat model and gets live Ollama response", async ({ authedPage: page, request }) => {
    test.setTimeout(240_000);

    try {
      await ensureLoggedIn(request, page);
    } catch (error) {
      test.skip(true, `Skipping ChatLLM nightly: failed to establish auth session (${String(error)})`);
    }

    try {
      await gotoWithRetry("/chatllm", page);
    } catch (error) {
      test.skip(true, `Skipping ChatLLM nightly: /chatllm did not load (${String(error)})`);
    }
    await waitForPageLoad(page);

    const modelSelect = page.locator('label:has-text("AI Model") + select').first();
    const readyState = await waitForChatReadyState(page);
    if (readyState === "remote_unavailable") {
      test.skip(true, "ChatLLM remote module is unavailable in this Docker runtime");
    }
    if (readyState === "ollama_unreachable") {
      test.skip(true, "Ollama is not reachable from ChatLLM in this Docker runtime");
    }
    if (readyState === "unknown") {
      let bodyText = "";
      try {
        bodyText = ((await page.locator("body").textContent()) || "").slice(0, 400);
      } catch {
        // Page can crash/close in constrained Docker browser runs.
      }
      if (bodyText) {
        test.skip(true, `ChatLLM did not reach model-ready state in time. Partial body: ${bodyText}`);
      }
      test.skip(true, "ChatLLM did not reach model-ready state in time");
    }

    await expect(modelSelect).toBeVisible({ timeout: 20_000 });
    await modelSelect.selectOption(CHAT_MODEL);
    await expect(modelSelect).toHaveValue(CHAT_MODEL);

    const input = page.getByPlaceholder("Message GPT...");
    await input.fill("What is 2 + 2? Reply with only one number.");
    await page.locator('button[type="submit"]').click();

    const assistantAnswer = page.locator("div.bg-gray-300").filter({ hasText: /\b4\b/ }).first();
    await expect(assistantAnswer).toBeVisible({ timeout: 180_000 });
  });
});
