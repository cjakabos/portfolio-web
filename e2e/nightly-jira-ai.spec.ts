import { type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { test, expect } from "./fixtures/test-base";
import { ensureAdminLoggedIn, waitForPageLoad } from "./fixtures/helpers";

const NIGHTLY_AI_E2E = process.env.NIGHTLY_AI_E2E === "1";
const NIGHTLY_ENABLE_JIRA_E2E = process.env.NIGHTLY_ENABLE_JIRA_E2E !== "0";
const JIRA_PROJECT_KEY = process.env.NIGHTLY_JIRA_PROJECT_KEY || process.env.JIRA_PROJECT_KEY || "";
const CHAT_MODEL = process.env.NIGHTLY_CHAT_MODEL || "qwen3:1.7b";
const JIRA_PROXY_BASE = process.env.NIGHTLY_JIRA_PROXY_URL || "http://localhost:80/jiraproxy/webDomain";

interface JiraIssue {
  key: string;
  fields: {
    summary?: string;
    description?: string;
    parent?: { key?: string } | null;
  };
}

interface JiraSearchResponse {
  issues?: JiraIssue[];
}

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

async function jiraGet(
  request: APIRequestContext,
  token: string,
  jiraPath: string
): Promise<Record<string, unknown>> {
  const response = await request.post(`${JIRA_PROXY_BASE}/get`, {
    data: { jiraPath },
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    failOnStatusCode: false,
  });

  if (!response.ok()) {
    throw new Error(`Jira GET failed (${response.status()}): ${await response.text()}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

async function jiraDelete(
  request: APIRequestContext,
  token: string,
  jiraPath: string
): Promise<boolean> {
  const response = await request.post(`${JIRA_PROXY_BASE}/delete`, {
    data: { jiraPath },
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    failOnStatusCode: false,
  });

  if (!response.ok()) {
    return false;
  }

  const body = await response.text();
  if (/404/.test(body)) return true;
  return /200|202|204/.test(body);
}

async function fetchProjectIssues(
  request: APIRequestContext,
  token: string
): Promise<JiraIssue[]> {
  const response = (await jiraGet(
    request,
    token,
    `/rest/api/latest/search/jql?jql=project=${JIRA_PROJECT_KEY}&maxResults=1000&fields=key,summary,description,issuetype,parent`
  )) as JiraSearchResponse;

  return Array.isArray(response.issues) ? response.issues : [];
}

async function waitForTicketBySummary(
  request: APIRequestContext,
  token: string,
  summary: string,
  timeoutMs = 120_000
): Promise<JiraIssue> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const issues = await fetchProjectIssues(request, token);
    const found = issues.find((issue) => issue.fields.summary === summary);
    if (found) return found;
    await sleep(2_000);
  }
  throw new Error(`Ticket with summary '${summary}' was not found within ${timeoutMs}ms`);
}

async function fetchChildKeys(
  request: APIRequestContext,
  token: string,
  parentKey: string
): Promise<string[]> {
  const issues = await fetchProjectIssues(request, token);
  return issues
    .filter((issue) => issue.fields.parent?.key === parentKey)
    .map((issue) => issue.key);
}

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
        const bodyText = ((await page.locator("body").textContent().catch(() => "")) || "")
          .replace(/\s+/g, " ")
          .slice(0, 1000);
        throw new Error(`Jira board error before ticket creation: ${title}. body="${bodyText}"`);
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

  const bodyText = ((await page.locator("body").textContent().catch(() => "")) || "")
    .replace(/\s+/g, " ")
    .slice(0, 1000);
  throw new Error(`Timed out waiting for Jira board to become interactive. body="${bodyText}"`);
}

async function createParentTicket(page: Page, summary: string, description: string): Promise<void> {
  const newTicketButton = await waitForJiraBoardInteractive(page);
  await newTicketButton.click({ timeout: 30_000 });

  const createModal = page
    .locator('h3:has-text("Create New Ticket")')
    .locator('xpath=ancestor::div[contains(@class,"max-w-lg")]')
    .first();
  await expect(createModal).toBeVisible({ timeout: 30_000 });

  await createModal.locator('label:has-text("Summary *") + input').fill(summary);
  await createModal.locator('label:has-text("Description") + textarea').fill(description);

  const typeSelect = createModal.locator('label:has-text("Type *") + select');
  await expect(typeSelect).toBeVisible();
  if ((await typeSelect.locator('option[value="Task"]').count()) > 0) {
    await typeSelect.selectOption("Task");
  } else {
    await typeSelect.selectOption({ index: 1 });
  }

  await createModal.getByRole("button", { name: "Create" }).click();
  await expect(createModal).toBeHidden({ timeout: 30_000 });
}

test.describe("Nightly AI Integration - Jira", () => {
  test.skip(!NIGHTLY_AI_E2E, "Nightly AI integration tests are disabled");
  test.skip(!NIGHTLY_ENABLE_JIRA_E2E, "Nightly Jira AI tests are disabled");
  test.skip(!JIRA_PROJECT_KEY, "NIGHTLY_JIRA_PROJECT_KEY is not set");

  test("creates + refines + proposes child tickets with AI and cleans up", async ({
    authedPage: page,
    request,
  }) => {
    test.setTimeout(600_000);

    const { token } = await ensureAdminLoggedIn(request, page);

    const runId = Date.now().toString(36);
    const parentSummary = `Nightly AI E2E Parent ${runId}`;
    const parentDescription = `Nightly AI Jira test parent ticket (${runId})`;

    let parentKey: string | null = null;
    const createdChildKeys = new Set<string>();
    const cleanupFailures: string[] = [];

    try {
      await page.goto("/jira", { waitUntil: "domcontentloaded" });
      await waitForPageLoad(page);

      const bodyText = (await page.locator("body").textContent()) || "";
      expect(bodyText).not.toContain("Access Denied");
      expect(bodyText).not.toContain("Module Load Error");
      expect(bodyText).not.toContain("Remote Module Unavailable");

      await openAiSidebarAndSelectModel(page);
      await createParentTicket(page, parentSummary, parentDescription);

      const parentTicket = await waitForTicketBySummary(request, token, parentSummary, 180_000);
      parentKey = parentTicket.key;
      console.log(`[nightly-jira] Created parent ticket: ${parentKey}`);

      await clickTicketAction(page, parentKey, "Chat with Ticket");

      const applyButton = page.getByRole("button", { name: "Apply as Changes" }).last();
      await expect(applyButton).toBeVisible({ timeout: 240_000 });
      await applyButton.click();

      await expect(page.getByRole("heading", { name: "Compare & Approve Changes" })).toBeVisible({
        timeout: 30_000,
      });
      await page.getByRole("button", { name: "Approve & Update" }).click();

      const improvedSummary = `Improved ${parentSummary}`;
      await expect(page.getByText(improvedSummary)).toBeVisible({ timeout: 120_000 });

      const childKeysBefore = await fetchChildKeys(request, token, parentKey);

      await clickTicketAction(page, parentKey, "Batch Create");
      const batchModal = page
        .locator('h3:has-text("Batch Create Tickets")')
        .locator('xpath=ancestor::div[contains(@class,"max-w-lg")]')
        .first();
      await expect(batchModal).toBeVisible({ timeout: 30_000 });

      const countInput = batchModal.locator('label:has-text("Count") + input[type="number"]');
      await countInput.fill("2");

      await batchModal.getByRole("button", { name: "Ask AI for Suggestions" }).click();

      await expect
        .poll(async () => batchModal.locator('input[type="checkbox"]').count(), {
          timeout: 240_000,
        })
        .toBeGreaterThan(0);

      await batchModal.getByRole("button", { name: "Create Selected" }).click();
      await expect(batchModal).toBeHidden({ timeout: 30_000 });

      await expect
        .poll(async () => (await fetchChildKeys(request, token, parentKey!)).length, {
          timeout: 180_000,
        })
        .toBeGreaterThan(childKeysBefore.length);

      const childKeysAfter = await fetchChildKeys(request, token, parentKey);
      childKeysAfter
        .filter((key) => !childKeysBefore.includes(key))
        .forEach((key) => createdChildKeys.add(key));

      expect(createdChildKeys.size).toBeGreaterThan(0);

      const createdKeys = [parentKey, ...Array.from(createdChildKeys)];
      console.log(`[nightly-jira] Created ticket keys: ${createdKeys.join(", ")}`);
      await test.info().attach("jira-created-keys.txt", {
        body: Buffer.from(createdKeys.join("\n"), "utf-8"),
        contentType: "text/plain",
      });
    } finally {
      if (parentKey) {
        const latestChildren = await fetchChildKeys(request, token, parentKey).catch(() => []);
        latestChildren.forEach((key) => createdChildKeys.add(key));
      }

      for (const childKey of createdChildKeys) {
        const deleted = await jiraDelete(request, token, `/rest/api/latest/issue/${childKey}`);
        if (deleted) {
          console.log(`[nightly-jira] Deleted child ticket: ${childKey}`);
        } else {
          cleanupFailures.push(childKey);
        }
      }

      if (parentKey) {
        const deleted = await jiraDelete(
          request,
          token,
          `/rest/api/latest/issue/${parentKey}?deleteSubtasks=true`
        );
        if (deleted) {
          console.log(`[nightly-jira] Deleted parent ticket: ${parentKey}`);
        } else {
          cleanupFailures.push(parentKey);
        }
      }

      if (cleanupFailures.length > 0) {
        throw new Error(`Failed to cleanup Jira tickets: ${cleanupFailures.join(", ")}`);
      }
    }
  });
});
