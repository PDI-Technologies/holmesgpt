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
    this.usernameInput = page.locator('input[type="text"], input[name="username"]').first();
    this.passwordInput = page.locator('input[type="password"]').first();
    this.submitButton = page.locator('button[type="submit"]').first();
    this.errorMessage = page.locator('[role="alert"], .error, [class*="error"]').first();
  }

  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async loginAndWait(username: string, password: string) {
    await this.login(username, password);
    await this.page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 30_000,
    });
  }

  async expectLoginFormVisible() {
    await expect(this.usernameInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async expectErrorVisible() {
    await expect(this.errorMessage).toBeVisible({ timeout: 5_000 });
  }
}
