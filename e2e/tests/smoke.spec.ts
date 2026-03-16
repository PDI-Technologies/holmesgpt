import { test, expect } from '../fixtures/authenticated';

/**
 * Smoke test suite — fast post-deployment verification.
 *
 * These tests run in under 2 minutes and verify the application is alive,
 * all major pages are accessible, and health endpoints return valid content.
 *
 * Usage:
 *   npm run test:smoke
 *   playwright test --grep @smoke
 */

test.describe('Smoke: Application Health @smoke', () => {
  test('health endpoint returns healthy status', async ({ request }) => {
    const baseURL = process.env.BASE_URL ?? 'https://holmesgpt.dev.platform.pditechnologies.com';
    const response = await request.get(`${baseURL}/healthz`);

    expect(response.status()).toBe(200);
    const body = await response.text();

    // Must contain a valid status value (healthy or ok)
    expect(body).toMatch(/healthy|ok/i);

    // Validate it's a proper JSON health response (not a redirect or HTML error page)
    expect(body).not.toContain('<html');
    expect(body).not.toContain('502 Bad Gateway');
    expect(body).not.toContain('503 Service Unavailable');
  });

  test('readyz endpoint confirms model is configured', async ({ request }) => {
    const baseURL = process.env.BASE_URL ?? 'https://holmesgpt.dev.platform.pditechnologies.com';
    const response = await request.get(`${baseURL}/readyz`);

    expect(response.status()).toBe(200);
    const body = await response.text();

    // Must be ready (status: ready or ok)
    expect(body).toMatch(/ready|ok/i);

    // Should reference the configured model (claude or anthropic)
    // This validates the LLM is actually configured, not just the server is up
    expect(body).toMatch(/claude|anthropic|model/i);
  });
});

test.describe('Smoke: Page Accessibility @smoke', () => {
  const pages = [
    { name: 'Chat', path: '/' },
    { name: 'Investigate', path: '/investigate' },
    { name: 'Integrations', path: '/integrations' },
    { name: 'Projects', path: '/projects' },
    { name: 'Settings', path: '/settings' },
    { name: 'History', path: '/history' },
    { name: 'Instances', path: '/instances' },
  ];

  for (const { name, path } of pages) {
    test(`${name} page loads with content`, async ({ page }) => {
      await page.goto(path);
      // Wait for React SPA to fully render — networkidle can be too fast for SPAs
      await page.waitForLoadState('networkidle');
      // Give React an extra moment to render dynamic content
      await page.waitForTimeout(1_000);

      // Page must have meaningful content (not blank)
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.trim().length).toBeGreaterThan(5);

      // Must not show a crash/error page
      expect(bodyText).not.toMatch(/Application Error|Something went wrong|Cannot GET/);

      // Must not be a login redirect (auth should be preserved)
      expect(page.url()).not.toContain('/login');

      // No fatal JS errors (filter known non-fatal CDN failures)
      const fatalErrors: string[] = [];
      page.on('pageerror', (err) => {
        const msg = err.message;
        if (!msg.includes('cdn.simpleicons.org') && !msg.includes('ERR_CONNECTION')) {
          fatalErrors.push(msg);
        }
      });
      await page.waitForTimeout(500);
      expect(fatalErrors).toHaveLength(0);
    });
  }
});

test.describe('Smoke: Integrations API @smoke', () => {
  test('integrations API returns enabled toolsets', async ({ request }) => {
    const baseURL = process.env.BASE_URL ?? 'https://holmesgpt.dev.platform.pditechnologies.com';

    // Login first to get a session cookie
    const loginResponse = await request.post(`${baseURL}/auth/login`, {
      data: {
        username: process.env.HOLMES_USERNAME ?? 'admin',
        password: process.env.HOLMES_PASSWORD ?? '',
      },
    });
    expect(loginResponse.status()).toBe(200);

    // Fetch integrations
    const integrationsResponse = await request.get(`${baseURL}/api/integrations`);
    expect(integrationsResponse.status()).toBe(200);

    const data = await integrationsResponse.json();

    // Must return an array or object with integration data
    expect(data).toBeTruthy();

    // Convert to string for content validation
    const dataStr = JSON.stringify(data);

    // Must include kubernetes (always enabled in this deployment)
    expect(dataStr).toMatch(/kubernetes/i);

    // Must include prometheus
    expect(dataStr).toMatch(/prometheus/i);

    // Must have at least one "enabled" integration
    expect(dataStr).toMatch(/enabled/i);
  });
});
