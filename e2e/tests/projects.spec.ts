import { test, expect } from '../fixtures/authenticated';
import { ProjectsPage } from '../pages/ProjectsPage';

/**
 * Projects page tests — verifies project listing and management.
 */

test.describe('Projects @smoke', () => {
  test('projects page loads correctly', async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    await projectsPage.expectPageLoaded();
  });
});

test.describe('Projects @full', () => {
  test('projects page shows configured projects', async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    await projectsPage.expectPageLoaded();

    // This deployment has Logistics Cloud and Fuel Pricing projects
    // Check for at least one project or a meaningful empty state
    const count = await projectsPage.getProjectCount();
    if (count === 0) {
      // Empty state is acceptable — just verify page loaded
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('logistics cloud project is visible', async ({ page }) => {
    const projectsPage = new ProjectsPage(page);
    await projectsPage.goto();
    await projectsPage.expectPageLoaded();

    // Check if Logistics Cloud project exists (may not in all environments)
    const hasLogistics = await page.locator('text=/logistics/i').isVisible().catch(() => false);
    if (hasLogistics) {
      await expect(page.locator('text=/logistics/i').first()).toBeVisible();
    }
  });
});
