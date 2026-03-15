import { Page, Locator, expect } from '@playwright/test';

/**
 * InvestigatePage — Page Object for the /investigate route.
 */
export class InvestigatePage {
  readonly page: Page;
  readonly titleInput: Locator;
  readonly descriptionInput: Locator;
  readonly submitButton: Locator;
  readonly resultsContainer: Locator;

  constructor(page: Page) {
    this.page = page;
    // Title / subject field
    this.titleInput = page.locator('input[placeholder*="title" i], input[placeholder*="subject" i], input[name="title"]').first();
    // Description / details textarea
    this.descriptionInput = page.locator('textarea[placeholder*="describe" i], textarea[placeholder*="detail" i], textarea').first();
    // Submit / investigate button
    this.submitButton = page.locator('button:has-text("Investigate"), button[type="submit"]').first();
    // Results area
    this.resultsContainer = page.locator('[class*="result"], [class*="investigation"], [class*="output"]').first();
  }

  async goto() {
    await this.page.goto('/investigate');
    await this.page.waitForLoadState('networkidle');
  }

  async fillAndSubmit(title: string, description: string) {
    const titleVisible = await this.titleInput.isVisible().catch(() => false);
    if (titleVisible) {
      await this.titleInput.fill(title);
    }
    await this.descriptionInput.fill(description);
    await this.submitButton.click();
  }

  async waitForInvestigationComplete(timeoutMs = 120_000) {
    // Wait for loading to finish
    await this.page.waitForFunction(
      () => {
        const indicators = document.querySelectorAll('[class*="loading"], [class*="thinking"], [class*="spinner"]');
        return indicators.length === 0;
      },
      { timeout: timeoutMs }
    );
  }

  async expectFormVisible() {
    await expect(this.descriptionInput).toBeVisible({ timeout: 10_000 });
    await expect(this.submitButton).toBeVisible({ timeout: 10_000 });
  }

  async expectPageLoaded() {
    await this.page.waitForLoadState('networkidle');
    // Investigate page should have some form elements or content
    await expect(this.page.locator('main, [role="main"], form, textarea, input')).toBeVisible({ timeout: 10_000 });
  }
}
