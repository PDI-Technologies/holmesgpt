import { Page, Locator, expect } from '@playwright/test';

/**
 * ChatPage — Page Object for the main chat interface (/chat or /).
 */
export class ChatPage {
  readonly page: Page;
  readonly messageInput: Locator;
  readonly sendButton: Locator;
  readonly messageList: Locator;
  readonly loadingIndicator: Locator;
  readonly newChatButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // Chat input — textarea or contenteditable
    this.messageInput = page.locator('textarea, [contenteditable="true"]').first();
    // Send button — look for common patterns
    this.sendButton = page.locator('button[type="submit"], button[aria-label*="send" i], button[aria-label*="Send"]').first();
    // Message list container
    this.messageList = page.locator('[class*="message"], [class*="chat"], [role="log"]').first();
    // Loading/thinking indicator
    this.loadingIndicator = page.locator('[class*="loading"], [class*="thinking"], [class*="spinner"]').first();
    // New chat button
    this.newChatButton = page.locator('button:has-text("New"), button[aria-label*="new" i]').first();
  }

  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async sendMessage(message: string) {
    await this.messageInput.fill(message);
    // Try submit button first, fall back to Enter key
    const submitBtn = this.page.locator('button[type="submit"]').first();
    const isVisible = await submitBtn.isVisible().catch(() => false);
    if (isVisible) {
      await submitBtn.click();
    } else {
      await this.messageInput.press('Enter');
    }
  }

  async sendMessageAndWaitForResponse(message: string, timeoutMs = 120_000) {
    await this.sendMessage(message);
    // Wait for loading to appear then disappear, or wait for a new assistant message
    await this.page.waitForFunction(
      () => {
        const indicators = document.querySelectorAll('[class*="loading"], [class*="thinking"], [class*="spinner"]');
        return indicators.length > 0;
      },
      { timeout: 10_000 }
    ).catch(() => {
      // Loading indicator may not appear — that's OK
    });

    // Wait for response to complete
    await this.page.waitForFunction(
      () => {
        const indicators = document.querySelectorAll('[class*="loading"], [class*="thinking"], [class*="spinner"]');
        return indicators.length === 0;
      },
      { timeout: timeoutMs }
    );
  }

  async getLastAssistantMessage(): Promise<string> {
    // Get the last message bubble that is from the assistant
    const messages = this.page.locator('[class*="message"], [class*="bubble"]');
    const count = await messages.count();
    if (count === 0) return '';
    return messages.nth(count - 1).innerText();
  }

  async expectChatInputVisible() {
    await expect(this.messageInput).toBeVisible({ timeout: 10_000 });
  }

  async expectResponseContains(text: string, timeoutMs = 120_000) {
    await expect(this.page.locator('body')).toContainText(text, { timeout: timeoutMs });
  }
}
