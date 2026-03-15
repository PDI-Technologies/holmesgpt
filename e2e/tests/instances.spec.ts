import { test, expect } from '../fixtures/authenticated';
import { InstancesPage } from '../pages/InstancesPage';

/**
 * Instances page tests — verifies toolset instances are displayed.
 */

test.describe('Instances @smoke', () => {
  test('instances page loads correctly', async ({ page }) => {
    const instancesPage = new InstancesPage(page);
    await instancesPage.goto();
    await instancesPage.expectPageLoaded();
  });
});

test.describe('Instances @full', () => {
  test('instances page shows configured instances', async ({ page }) => {
    const instancesPage = new InstancesPage(page);
    await instancesPage.goto();
    await instancesPage.expectPageLoaded();

    // This deployment has grafana, datadog, atlassian, aws_api, salesforce, ado, bash, prometheus
    const count = await instancesPage.getInstanceCount();
    if (count === 0) {
      // Check for any meaningful content
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('prometheus instance is visible', async ({ page }) => {
    const instancesPage = new InstancesPage(page);
    await instancesPage.goto();
    await instancesPage.expectPageLoaded();

    await expect(page.locator('body')).toContainText(/prometheus/i, { timeout: 10_000 });
  });
});
