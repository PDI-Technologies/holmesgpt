import { Page, Locator, expect } from '@playwright/test';

/**
 * LoginPage — Page Object for the /login route.
 */
export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.locator('#username, input[type="text"], input[name="username"]').first();
    this.passwordInput = page.locator('input[type="password"]').first();
    this.submitButton = page.locator('button[type="submit"]').first();
    this.errorMessage = page.locator('[role="alert"], .error, [class*="error"]').first();
  }

  async goto() {
    await this.page.goto('/login');
    // Wait for React SPA to hydrate and render the form
    await this.page.waitForSelector('input[type="password"]', { timeout: 15_000 });
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async loginAndWait(username: string, password: string) {
    await this.login(username, password);
    // This app does NOT use URL routing — it's a pure React state SPA.
    // The URL stays at /login forever; the app just swaps components.
    // Wait for the login form to unmount (password input disappears)
    // and the main app layout to appear (sidebar nav or chat textarea).
    await this.page.waitForSelector('input[type="password"]', {
      state: 'detached',
      timeout: 30_000,
    });
  }

  async expectLoginFormVisible() {
    await expect(this.usernameInput).toBeVisible({ timeout: 10_000 });
    await expect(this.passwordInput).toBeVisible({ timeout: 10_000 });
    await expect(this.submitButton).toBeVisible({ timeout: 10_000 });
  }

  async expectErrorVisible() {
    await expect(this.errorMessage).toBeVisible({ timeout: 5_000 });
  }
}
