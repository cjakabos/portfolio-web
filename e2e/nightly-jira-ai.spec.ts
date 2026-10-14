import { type Locator, type Page } from "@playwright/test";
import { test, expect } from "./fixtures/test-base";
import { ensureAdminLoggedIn, waitForPageLoad } from "./fixtures/helpers";
import { JiraReadOnlyBoundary } from "./fixtures/jira-read-only";

const NIGHTLY_AI_E2E = process.env.NIGHTLY_AI_E2E === "1";
const READ_ONLY_ENABLED = process.env.NIGHTLY_ENABLE_JIRA_READ_ONLY_E2E === "1";
const JIRA_PROJECT_KEY = process.env.NIGHTLY_JIRA_PROJECT_KEY || "";
const CHAT_MODEL = process.env.NIGHTLY_CHAT_MODEL || "qwen3:1.7b";
const JIRA_PROXY_BASE = process.env.NIGHTLY_JIRA_PROXY_URL || "http://localhost:80/jiraproxy/webDomain";

test.use({ serviceWorkers: "block" });

async function getTicketRow(page: Page, ticketKey: string): Promise<Locator> {
  const keyLabel = page.locator("span.font-mono", { hasText: ticketKey }).first();
  const refreshButton = page.getByTitle("Refresh").first();
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    if (await keyLabel.isVisible().catch(() => false)) {
      return keyLabel.locator('xpath=ancestor::div[contains(@class,"group")][1]');
    }

    // The ticket can exist in Jira before the board list refresh completes.
    if (await refreshButton.isVisible().catch(() => false)) {
      await refreshButton.click().catch(() => {});
    }
    await page.waitForTimeout(2_000);
  }

  await expect(keyLabel).toBeVisible({ timeout: 5_000 });
  return keyLabel.locator('xpath=ancestor::div[contains(@class,"group")][1]');
}

async function clickTicketAction(page: Page, ticketKey: string, title: string): Promise<void> {
  const row = await getTicketRow(page, ticketKey);
  await row.hover();
  const actionButton = row.getByTitle(title);
  await expect(actionButton).toBeVisible({ timeout: 30_000 });
  await actionButton.click({ force: true });
}

async function openAiSidebarAndSelectModel(page: Page): Promise<void> {
  const toggleAiButton = page.getByRole("button", { name: /Local GPT|Close AI/ }).first();
  await expect(toggleAiButton).toBeVisible({ timeout: 120_000 });
  const toggleLabel = (await toggleAiButton.textContent()) || "";
  if (toggleLabel.includes("Local GPT")) {
    await toggleAiButton.click();
  }

  const modelSelect = page.locator('label:has-text("AI Model") + select').first();
  await expect(modelSelect).toBeVisible({ timeout: 120_000 });
  await modelSelect.selectOption(CHAT_MODEL);
  await expect(modelSelect).toHaveValue(CHAT_MODEL);
}

async function waitForJiraBoardInteractive(page: Page): Promise<Locator> {
  const newTicketButton = page.locator('button:has-text("New Ticket")').first();
  const refreshButton = page.getByTitle("Refresh").first();
  const knownErrorTitles = [
    "Jira Authentication Failed",
    "Permission Denied",
    "Project Not Found",
    "Network Error",
    "Unexpected Error",
    "Jira Configuration Missing",
  ];
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    for (const title of knownErrorTitles) {
      const alert = page.getByText(title).first();
      if (await alert.isVisible().catch(() => false)) {
        throw new Error(`Jira board read failed: ${title}`);
      }
    }

    if (await newTicketButton.isVisible().catch(() => false)) {
      if (await newTicketButton.isEnabled().catch(() => false)) {
        return newTicketButton;
      }
      if (await refreshButton.isVisible().catch(() => false)) {
        await refreshButton.click().catch(() => {});
      }
    }

    await page.waitForTimeout(2_000);
  }

  throw new Error("Timed out waiting for the read-only Jira board");
}

test.describe("Nightly AI Integration - Jira read-only", () => {
  test.skip(!NIGHTLY_AI_E2E || !READ_ONLY_ENABLED, "Read-only Jira check requires explicit opt-in");

  test("reads existing fixture issues and previews an AI proposal without Jira writes", async ({ authedPage: page, request }) => {
    test.setTimeout(600_000);
    const boundary = new JiraReadOnlyBoundary(JIRA_PROXY_BASE, JIRA_PROJECT_KEY);
    await boundary.install(page.context());
    try {
      const { token } = await ensureAdminLoggedIn(request, page);
      const result = await boundary.read(request,
        `/rest/api/latest/search/jql?jql=project=${JIRA_PROJECT_KEY}&maxResults=1000&fields=key,summary,description,issuetype,parent`, token);
      const issues = result.issues as { key?: string }[] | undefined;
      const fixture = issues?.find(issue => issue.key && new RegExp(`^${JIRA_PROJECT_KEY}-[0-9]+$`).test(issue.key));
      expect(fixture?.key, "Seed an existing issue in the dedicated fixture project before opting in").toBeTruthy();
      await page.goto("/jira", { waitUntil: "domcontentloaded" });
      await waitForPageLoad(page);
      await waitForJiraBoardInteractive(page);
      await openAiSidebarAndSelectModel(page);
      await clickTicketAction(page, fixture!.key!, "Chat with Ticket");
      const preview = page.getByRole("button", { name: "Apply as Changes" }).last();
      await expect(preview).toBeVisible({ timeout: 240_000 });
      await preview.click(); // Opens comparison only; no Approve & Update action.
      await expect(page.getByRole("heading", { name: "Compare & Approve Changes" })).toBeVisible({ timeout: 30_000 });
    } finally {
      boundary.assertClean();
    }
  });
});
