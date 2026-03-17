import { chromium, FullConfig } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Global setup: authenticate once and save session state.
 * All tests reuse this auth state — no per-test login needed.
 *
 * Auth state is saved to e2e/.auth/user.json and gitignored.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL ?? 'https://holmesgpt.dev.platform.pditechnologies.com';
  const username = process.env.HOLMES_USERNAME ?? 'admin';
  const password = process.env.HOLMES_PASSWORD;

  if (!password) {
    throw new Error(
      'HOLMES_PASSWORD environment variable is required.\n' +
      'Set it via: export HOLMES_PASSWORD="<password>"\n' +
      'In CI, configure it as a GitHub Actions secret.'
    );
  }

  // Ensure .auth directory exists
  const authDir = path.join(__dirname, '..', '.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  try {
    // Navigate to login page and wait for React SPA to hydrate
    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });

    // Wait for the password input — most reliable indicator the form is ready
    await page.waitForSelector('input[type="password"]', { timeout: 30_000 });

    // Fill username — try multiple selector strategies
    const usernameInput = page.locator('input[type="text"], input[name="username"], input[id="username"], input[placeholder*="ser"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    await usernameInput.fill(username);
    await passwordInput.fill(password);

    // Submit the form
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();

    // This app is a pure React state SPA — the URL never changes from /login.
    // The app just conditionally renders <LoginPage> or <Layout> based on auth state.
    // Wait for the password input to detach (login form unmounts on success).
    await page.waitForSelector('input[type="password"]', {
      state: 'detached',
      timeout: 60_000,
    });

    // Save auth state
    const authFile = path.join(authDir, 'user.json');
    await context.storageState({ path: authFile });
    console.log(`✅ Auth state saved to ${authFile}`);
  } catch (err) {
    // Capture screenshot for debugging
    const screenshotPath = path.join(__dirname, '..', 'test-results', 'global-setup-failure.png');
    const screenshotDir = path.dirname(screenshotPath);
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.error(`❌ Global setup failed. Screenshot saved to ${screenshotPath}`);
    console.error(`   Current URL: ${page.url()}`);
    throw err;
  } finally {
    await browser.close();
  }
}
