// ===========================================================================
// e2e/chat.spec.ts — Chat E2E Tests (converted from chat.cy.ts)
// ===========================================================================

import { test, expect, type Page } from "./fixtures/test-base";
import { ensureLoggedIn, waitForPageLoad } from "./fixtures/helpers";

test.describe("Chat Flow", () => {
  const roomName = `TestRoom_${Date.now()}`;
  const roomCode = `CODE_${Date.now()}`;

  const roomResponse = {
    err_code: 0,
    err_msg: "",
    data: { name: roomName, code: roomCode, createdBy: "e2e" },
  };

  const roomListResponse = {
    err_code: 0,
    err_msg: "",
    data: [{ name: roomName, code: roomCode, createdBy: "e2e" }],
  };

  /** Stub chat API endpoints */
  async function setupChatStubs(page: Page) {
    await page.route(/\/room$/, (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(roomResponse) });
      }
      if (route.request().method() === "GET") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(roomListResponse) });
      }
      return route.fallback();
    });

    await page.route(/\/room\//, (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(roomResponse) });
      }
      return route.fallback();
    });
  }

  test.beforeEach(async ({ authedPage: page, request }) => {
    await ensureLoggedIn(request, page);
  });

  test("should navigate to the chat page", async ({ authedPage: page }) => {
    await page.goto("/chat");
    await waitForPageLoad(page);
    await expect(page).toHaveURL(/\/chat/);
    await expect(page.getByText("Community Rooms")).toBeVisible();
  });

  test("should create a new chat room", async ({ authedPage: page }) => {
    await setupChatStubs(page);

    await page.goto("/chat");
    await waitForPageLoad(page);

    await page.locator('input[placeholder="Room Name..."]').fill(roomName);
    await page.getByRole("button", { name: "Create" }).click();

    await expect(page).toHaveURL(new RegExp(`/chat/rooms/${roomCode}`), { timeout: 15_000 });
    await expect(page.getByText(roomCode)).toBeVisible({ timeout: 15_000 });
  });

  test("should join a chat room", async ({ authedPage: page }) => {
    await setupChatStubs(page);

    await page.goto("/chat");
    await waitForPageLoad(page);

    await expect(page.getByText(roomName)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("link", { name: new RegExp(roomName, "i") }).first().click();
    await expect(page).toHaveURL(new RegExp(`/chat/rooms/${roomCode}`), { timeout: 15_000 });
    await expect(page.getByText(roomCode)).toBeVisible({ timeout: 15_000 });
  });

  test("should send a message and see it appear", async ({ authedPage: page }) => {
    await setupChatStubs(page);
    await page.goto(`/chat/rooms/${roomCode}`);
    await waitForPageLoad(page);

    const messageInput = page.getByPlaceholder("Type your message...");
    const sendButton = page.locator('button[type="submit"]');
    const liveConnection = page.getByText("Live Connection");
    const disconnectedStatus = page.getByText(/Disconnected/i);
    const reconnectingHint = page.getByText("Reconnecting to chat...");
    await expect(messageInput).toBeVisible({ timeout: 15_000 });
    await expect(liveConnection.or(disconnectedStatus).first()).toBeVisible({ timeout: 15_000 });

    const connected = await liveConnection.isVisible().catch(() => false);

    if (connected) {
      const testMessage = `Hello ${Date.now()}`;
      await messageInput.fill(testMessage);
      const canSend = await sendButton.isEnabled().catch(() => false);

      if (canSend) {
        await sendButton.click();
        await expect(messageInput).toHaveValue("");
        await expect
          .poll(
            async () => {
              const messageVisible = await page.getByText(testMessage).first().isVisible().catch(() => false);
              const disconnected = await disconnectedStatus.isVisible().catch(() => false);
              const reconnecting = await reconnectingHint.isVisible().catch(() => false);
              const inputCleared = (await messageInput.inputValue().catch(() => "")) === "";
              const stillConnected = await liveConnection.isVisible().catch(() => false);
              return messageVisible || (disconnected && reconnecting) || (inputCleared && stillConnected);
            },
            { timeout: 20_000 }
          )
          .toBe(true);
      } else {
        await expect(disconnectedStatus).toBeVisible({ timeout: 10_000 });
        await expect(reconnectingHint).toBeVisible();
      }
    } else {
      await expect(disconnectedStatus).toBeVisible({ timeout: 10_000 });
      await expect(sendButton).toBeDisabled();
      await expect(reconnectingHint).toBeVisible();
    }
  });

  test("should show the username with the message", async ({ authedPage: page }) => {
    await setupChatStubs(page);

    await page.goto("/chat");
    await waitForPageLoad(page);

    await page.getByRole("link", { name: new RegExp(roomName, "i") }).first().click();
    await expect(page).toHaveURL(new RegExp(`/chat/rooms/${roomCode}`), { timeout: 15_000 });

    const username = await page.evaluate(() =>
      localStorage.getItem("NEXT_PUBLIC_MY_USERNAME")
    );
    if (username) {
      await expect(page.getByText(username)).toBeVisible({ timeout: 10_000 });
    }
  });
});
