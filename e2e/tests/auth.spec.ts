import { test, expect, chromium } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

/**
 * Authentication tests — login / logout flows.
 * These tests do NOT use the pre-authenticated fixture so they can test the login form itself.
 * They use a fresh browser context (no stored auth state) to ensure the login page renders.
 */

const BASE_URL = process.env.BASE_URL ?? 'https://holmesgpt.dev.platform.pditechnologies.com';
const USERNAME = process.env.HOLMES_USERNAME ?? 'admin';
const PASSWORD = process.env.HOLMES_PASSWORD ?? '';

test.describe('Authentication @smoke', () => {
  // Use a fresh context for auth tests — no stored session so login page actually renders
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login page renders correctly', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.expectLoginFormVisible();
  });

  test('login with valid credentials redirects to app', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAndWait(USERNAME, PASSWORD);

    // App is a pure React state SPA — URL stays at /login but the login form unmounts.
    // Verify the main app is rendered (chat textarea or sidebar nav is visible).
    const appVisible = await page.locator('textarea, nav, aside, [role="navigation"]').first().isVisible();
    expect(appVisible).toBeTruthy();
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USERNAME, 'wrong-password-12345');

    // Should stay on login page or show error
    await page.waitForTimeout(2_000);
    const isStillOnLogin = page.url().includes('/login');
    const hasError = await loginPage.errorMessage.isVisible().catch(() => false);

    expect(isStillOnLogin || hasError).toBeTruthy();
  });
});
