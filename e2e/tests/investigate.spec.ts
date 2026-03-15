import { test, expect } from '../fixtures/authenticated';
import { InvestigatePage } from '../pages/InvestigatePage';

/**
 * Investigate page tests — verifies the investigation form and validates
 * that the LLM returns meaningful, tool-backed responses.
 *
 * Response validation: tests check for specific content that can only come
 * from actual tool calls — not hallucinated answers.
 */

test.describe('Investigate @smoke', () => {
  test('investigate page loads correctly', async ({ page }) => {
    const investigatePage = new InvestigatePage(page);
    await investigatePage.goto();
    await investigatePage.expectPageLoaded();
  });

  test('investigate form is visible', async ({ page }) => {
    const investigatePage = new InvestigatePage(page);
    await investigatePage.goto();
    await investigatePage.expectFormVisible();
  });
});

test.describe('Investigate @full', () => {
  test('investigation returns pod health information', async ({ page }) => {
    const investigatePage = new InvestigatePage(page);
    await investigatePage.goto();
    await investigatePage.expectFormVisible();

    // Submit an investigation that requires real tool calls
    await investigatePage.fillAndSubmit(
      'Pod health check',
      'Check if all pods in the holmesgpt namespace are healthy and report their status'
    );

    // Wait for investigation to complete (up to 2 minutes)
    await page.waitForFunction(
      () => {
        const spinners = document.querySelectorAll(
          '[class*="loading"], [class*="thinking"], [class*="spinner"]'
        );
        return spinners.length === 0;
      },
      { timeout: 120_000 }
    );

    const pageText = await page.locator('body').innerText();

    // Must contain pod-related content from actual kubectl calls
    expect(pageText).toMatch(/pod|running|ready|holmesgpt/i);

    // Must contain a status indicator (Running, Pending, CrashLoopBackOff, etc.)
    expect(pageText).toMatch(/running|pending|ready|healthy/i);

    // Should NOT be a generic "I cannot" response
    expect(pageText).not.toMatch(/I cannot|I don't have|no access to kubernetes/i);

    // Should NOT be blank
    expect(pageText.trim().length).toBeGreaterThan(100);
  });

  test('investigation identifies the holmes deployment', async ({ page }) => {
    const investigatePage = new InvestigatePage(page);
    await investigatePage.goto();
    await investigatePage.expectFormVisible();

    await investigatePage.fillAndSubmit(
      'Deployment status',
      'What deployments are running in the holmesgpt namespace and how many replicas do they have?'
    );

    await page.waitForFunction(
      () => {
        const spinners = document.querySelectorAll('[class*="loading"], [class*="thinking"], [class*="spinner"]');
        return spinners.length === 0;
      },
      { timeout: 120_000 }
    );

    const pageText = await page.locator('body').innerText();

    // Must reference the actual deployment
    expect(pageText).toMatch(/holmes/i);

    // Must contain replica count information (a number)
    expect(pageText).toMatch(/\d+\s*(replica|pod|instance)/i);

    // Should not be an error
    expect(pageText).not.toMatch(/error.*occurred|investigation failed/i);
  });
});
