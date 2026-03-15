import { Page, Locator, expect } from '@playwright/test';

/**
 * SettingsPage — Page Object for the /settings route.
 */
export class SettingsPage {
  readonly page: Page;
  readonly modelSelector: Locator;
  readonly saveButton: Locator;
  readonly llmInstructionsInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modelSelector = page.locator('select[name*="model" i], input[name*="model" i], [class*="model"]').first();
    this.saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
    this.llmInstructionsInput = page.locator('textarea[name*="instruction" i], textarea[placeholder*="instruction" i]').first();
  }

  async goto() {
    await this.page.goto('/settings');
    await this.page.waitForLoadState('networkidle');
  }

  async expectPageLoaded() {
    await this.page.waitForLoadState('networkidle');
    await expect(this.page.locator('main, [role="main"], h1, h2, form, [class*="setting"]')).toBeVisible({ timeout: 10_000 });
  }

  async expectSettingsVisible() {
    // Settings page should have some form controls
    const hasContent = await this.page.locator('input, select, textarea, button').count();
    expect(hasContent).toBeGreaterThan(0);
  }
}
