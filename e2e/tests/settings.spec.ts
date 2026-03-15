import { test, expect } from '../fixtures/authenticated';
import { SettingsPage } from '../pages/SettingsPage';

/**
 * Settings page tests — verifies settings page loads and is functional.
 */

test.describe('Settings @smoke', () => {
  test('settings page loads correctly', async ({ page }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await settingsPage.expectPageLoaded();
  });
});

test.describe('Settings @full', () => {
  test('settings page has form controls', async ({ page }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await settingsPage.expectPageLoaded();
    await settingsPage.expectSettingsVisible();
  });

  test('model configuration is visible', async ({ page }) => {
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await settingsPage.expectPageLoaded();

    // Model setting should be visible
    await expect(page.locator('body')).toContainText(/model/i, { timeout: 10_000 });
  });
});
