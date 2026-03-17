import { Page, Locator, expect } from '@playwright/test';

/**
 * IntegrationsPage — Page Object for the /integrations route.
 */
export class IntegrationsPage {
  readonly page: Page;
  readonly integrationCards: Locator;
  readonly enabledBadges: Locator;
  readonly failedBadges: Locator;
  readonly disabledBadges: Locator;

  constructor(page: Page) {
    this.page = page;
    // Integration cards / list items
    this.integrationCards = page.locator('[class*="integration"], [class*="card"], [class*="toolset"]');
    // Status badges
    this.enabledBadges = page.locator('[class*="enabled"], [class*="active"], :text("enabled"), :text("active")');
    this.failedBadges = page.locator('[class*="failed"], [class*="error"], :text("failed"), :text("error")');
    this.disabledBadges = page.locator('[class*="disabled"], :text("disabled")');
  }

  async goto() {
    await this.page.goto('/integrations');
    await this.page.waitForLoadState('networkidle');
  }

  async expectPageLoaded() {
    await this.page.waitForLoadState('networkidle');
    // Page should have some content
    await expect(this.page.locator('main, [role="main"], h1, h2, [class*="integration"]')).toBeVisible({ timeout: 10_000 });
  }

  async getIntegrationCount(): Promise<number> {
    return this.integrationCards.count();
  }

  async expectAtLeastOneIntegration() {
    await expect(this.integrationCards.first()).toBeVisible({ timeout: 10_000 });
  }

  async expectIntegrationVisible(name: string) {
    await expect(this.page.locator(`text=${name}`)).toBeVisible({ timeout: 10_000 });
  }

  async getStatusSummary(): Promise<{ enabled: number; failed: number; disabled: number }> {
    const enabled = await this.enabledBadges.count();
    const failed = await this.failedBadges.count();
    const disabled = await this.disabledBadges.count();
    return { enabled, failed, disabled };
  }
}
