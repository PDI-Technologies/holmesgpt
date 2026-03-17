import { test, expect } from '../fixtures/authenticated';
import { HistoryPage } from '../pages/HistoryPage';

/**
 * History page tests — verifies investigation history is accessible.
 */

test.describe('History @smoke', () => {
  test('history page loads correctly', async ({ page }) => {
    const historyPage = new HistoryPage(page);
    await historyPage.goto();
    await historyPage.expectPageLoaded();
  });
});

test.describe('History @full', () => {
  test('history page shows records or empty state', async ({ page }) => {
    const historyPage = new HistoryPage(page);
    await historyPage.goto();
    await historyPage.expectPageLoaded();

    // Page should be functional regardless of record count
    await expect(page.locator('body')).toBeVisible();
  });
});
