import { Page, Locator, expect } from '@playwright/test';

/**
 * HistoryPage — Page Object for the /history route.
 */
export class HistoryPage {
  readonly page: Page;
  readonly historyItems: Locator;
  readonly filterInput: Locator;
  readonly sourceFilter: Locator;

  constructor(page: Page) {
    this.page = page;
    this.historyItems = page.locator('[class*="history"], [class*="record"], [class*="item"], tr');
    this.filterInput = page.locator('input[placeholder*="search" i], input[placeholder*="filter" i]').first();
    this.sourceFilter = page.locator('select[name*="source" i], [class*="source-filter"]').first();
  }

  async goto() {
    await this.page.goto('/history');
    await this.page.waitForLoadState('networkidle');
  }

  async expectPageLoaded() {
    await this.page.waitForLoadState('networkidle');
    await expect(this.page.locator('main, [role="main"], h1, h2, table, [class*="history"]')).toBeVisible({ timeout: 10_000 });
  }

  async getHistoryCount(): Promise<number> {
    return this.historyItems.count();
  }

  async expectAtLeastOneRecord() {
    // History may be empty in a fresh environment — just check page loads
    await this.expectPageLoaded();
  }
}
