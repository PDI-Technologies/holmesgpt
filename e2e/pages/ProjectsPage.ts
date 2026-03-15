import { Page, Locator, expect } from '@playwright/test';

/**
 * ProjectsPage — Page Object for the /projects route.
 */
export class ProjectsPage {
  readonly page: Page;
  readonly projectCards: Locator;
  readonly createButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.projectCards = page.locator('[class*="project"], [class*="card"]');
    this.createButton = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add")').first();
    this.searchInput = page.locator('input[placeholder*="search" i], input[type="search"]').first();
  }

  async goto() {
    await this.page.goto('/projects');
    await this.page.waitForLoadState('networkidle');
  }

  async expectPageLoaded() {
    await this.page.waitForLoadState('networkidle');
    await expect(this.page.locator('main, [role="main"], h1, h2, [class*="project"]')).toBeVisible({ timeout: 10_000 });
  }

  async getProjectCount(): Promise<number> {
    return this.projectCards.count();
  }

  async expectProjectVisible(name: string) {
    await expect(this.page.locator(`text=${name}`)).toBeVisible({ timeout: 10_000 });
  }

  async expectAtLeastOneProject() {
    await expect(this.projectCards.first()).toBeVisible({ timeout: 10_000 });
  }
}
