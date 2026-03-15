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

  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  try {
    // Navigate to login page
    await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });

    // Wait for React SPA to hydrate
    await page.waitForSelector('input[type="text"], input[name="username"], input[placeholder*="sername"]', {
      timeout: 15_000,
    });

    // Fill credentials
    const usernameInput = page.locator('input[type="text"], input[name="username"]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    await usernameInput.fill(username);
    await passwordInput.fill(password);

    // Submit
    await page.locator('button[type="submit"]').click();

    // Wait for successful login — chat page or main app loads
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 30_000,
    });

    // Save auth state
    const authFile = path.join(authDir, 'user.json');
    await context.storageState({ path: authFile });
    console.log(`✅ Auth state saved to ${authFile}`);
  } finally {
    await browser.close();
  }
}
