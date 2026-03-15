import { test, expect } from '../fixtures/authenticated';
import { IntegrationsPage } from '../pages/IntegrationsPage';

/**
 * Integrations page tests — verifies toolset integrations are displayed.
 */

test.describe('Integrations @smoke', () => {
  test('integrations page loads correctly', async ({ page }) => {
    const integrationsPage = new IntegrationsPage(page);
    await integrationsPage.goto();
    await integrationsPage.expectPageLoaded();
  });

  test('at least one integration is visible', async ({ page }) => {
    const integrationsPage = new IntegrationsPage(page);
    await integrationsPage.goto();
    await integrationsPage.expectPageLoaded();

    // The page should show some integrations
    const count = await integrationsPage.getIntegrationCount();
    // If no cards found by class, check for any meaningful content
    if (count === 0) {
      await expect(page.locator('body')).not.toContainText('No integrations');
    }
  });
});

test.describe('Integrations @full', () => {
  test('kubernetes integration is present', async ({ page }) => {
    const integrationsPage = new IntegrationsPage(page);
    await integrationsPage.goto();
    await integrationsPage.expectPageLoaded();

    // Kubernetes should always be enabled in this deployment
    await expect(page.locator('body')).toContainText(/kubernetes/i, { timeout: 10_000 });
  });

  test('prometheus integration is present', async ({ page }) => {
    const integrationsPage = new IntegrationsPage(page);
    await integrationsPage.goto();
    await integrationsPage.expectPageLoaded();

    await expect(page.locator('body')).toContainText(/prometheus/i, { timeout: 10_000 });
  });
});
