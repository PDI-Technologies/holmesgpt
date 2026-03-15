import { test as base, expect } from '@playwright/test';
import * as path from 'path';

/**
 * Authenticated fixture — extends the base test with a pre-logged-in page.
 * Uses the auth state saved by global-setup.ts.
 *
 * Usage:
 *   import { test, expect } from '../fixtures/authenticated';
 *   test('my test', async ({ page }) => { ... });
 */
export const test = base.extend({
  storageState: path.join(__dirname, '..', '.auth', 'user.json'),
});

export { expect };
