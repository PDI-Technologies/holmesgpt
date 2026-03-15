import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

/**
 * Authentication tests — login / logout flows.
 * These tests do NOT use the pre-authenticated fixture so they can test the login form itself.
 */

const BASE_URL = process.env.BASE_URL ?? 'https://holmesgpt.dev.platform.pditechnologies.com';
const USERNAME = process.env.HOLMES_USERNAME ?? 'admin';
const PASSWORD = process.env.HOLMES_PASSWORD ?? '';

test.describe('Authentication @smoke', () => {
  test('login page renders correctly', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.expectLoginFormVisible();
  });

  test('login with valid credentials redirects to app', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAndWait(USERNAME, PASSWORD);

    // Should be on the main app now
    expect(page.url()).not.toContain('/login');
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
