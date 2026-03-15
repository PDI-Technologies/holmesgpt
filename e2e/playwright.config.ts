import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for HolmesGPT E2E tests.
 *
 * Environment variables:
 *   BASE_URL          - App URL (default: https://holmesgpt.dev.platform.pditechnologies.com)
 *   HOLMES_USERNAME   - Login username (default: admin)
 *   HOLMES_PASSWORD   - Login password (required in CI via secret)
 *   CI                - Set by GitHub Actions; enables stricter timeouts and retries
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,   // Holmes investigations are stateful; run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'on-failure', outputFolder: 'playwright-report' }]],

  use: {
    baseURL: process.env.BASE_URL ?? 'https://holmesgpt.dev.platform.pditechnologies.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    // Accept self-signed certs in dev
    ignoreHTTPSErrors: true,
    // Generous timeout for LLM responses
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  timeout: 120_000,   // LLM investigations can take up to 2 minutes

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Reuse auth state saved by global-setup.ts
        storageState: '.auth/user.json',
      },
    },
  ],

  // Global setup: authenticate once and reuse session
  globalSetup: './utils/global-setup.ts',
});
