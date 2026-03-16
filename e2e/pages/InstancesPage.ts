import { Page, Locator, expect } from '@playwright/test';

/**
 * InstancesPage — Page Object for the /instances route.
 */
export class InstancesPage {
  readonly page: Page;
  readonly instanceCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.instanceCards = page.locator('[class*="instance"], [class*="card"], [class*="toolset"]');
  }

  async goto() {
    await this.page.goto('/instances');
    await this.page.waitForLoadState('networkidle');
  }

  async expectPageLoaded() {
    await this.page.waitForLoadState('networkidle');
    await expect(this.page.locator('main, [role="main"], h1, h2, [class*="instance"]').first()).toBeVisible({ timeout: 10_000 });
  }

  async getInstanceCount(): Promise<number> {
    return this.instanceCards.count();
  }

  async expectAtLeastOneInstance() {
    await expect(this.instanceCards.first()).toBeVisible({ timeout: 10_000 });
  }

  async expectInstanceVisible(name: string) {
    await expect(this.page.locator(`text=${name}`)).toBeVisible({ timeout: 10_000 });
  }
}
