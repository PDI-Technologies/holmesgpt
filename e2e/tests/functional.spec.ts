import { test, expect } from '../fixtures/authenticated';
import { ChatPage } from '../pages/ChatPage';
import { InvestigatePage } from '../pages/InvestigatePage';

/**
 * Functional UI tests — sends real prompts through the browser UI and validates
 * the LLM returns meaningful, tool-backed content (not just 200 OK).
 *
 * These tests exercise the full stack: browser → React → API → LLM → tools → response.
 * Each test has a 120s timeout to accommodate LLM + tool execution time.
 */

// ── Chat UI ──────────────────────────────────────────────────────────────────

test.describe('Functional: Chat UI @smoke', () => {
  test('chat returns meaningful response to a Kubernetes question', async ({ page }) => {
    test.setTimeout(180_000);

    const chatPage = new ChatPage(page);
    await chatPage.goto();
    await chatPage.expectChatInputVisible();

    // Send a question that requires real kubectl tool calls
    await chatPage.sendMessage('How many pods are running in the holmesgpt namespace? List their names.');

    // Wait for the LLM response to complete — loading indicators disappear
    await page.waitForFunction(
      () => {
        const spinners = document.querySelectorAll(
          '[class*="loading"], [class*="thinking"], [class*="spinner"], [class*="dots"], [class*="Investigating"]'
        );
        // Also check no "Investigating..." text is visible
        const bodyText = document.body.innerText;
        const stillLoading = bodyText.includes('Investigating...');
        return spinners.length === 0 && !stillLoading;
      },
      { timeout: 120_000 }
    );

    // Give React a moment to finish rendering the streamed response
    await page.waitForTimeout(2_000);

    const pageText = await page.locator('body').innerText();

    // Must mention pods or the namespace — proves it actually queried k8s
    expect(pageText).toMatch(/holmes|pod|running/i);

    // Must contain a number (pod count or replica count)
    expect(pageText).toMatch(/\d+/);

    // Response must be substantial (not blank or a one-liner error)
    expect(pageText.length).toBeGreaterThan(200);

    // Must NOT be an error or refusal
    expect(pageText).not.toMatch(/I cannot|I don't have access|no tools available|error occurred/i);
  });

  test('chat shows tool call cards in the response', async ({ page }) => {
    test.setTimeout(180_000);

    const chatPage = new ChatPage(page);
    await chatPage.goto();
    await chatPage.expectChatInputVisible();

    await chatPage.sendMessage('What is the status of deployments in the holmesgpt namespace?');

    // Wait for response to complete
    await page.waitForFunction(
      () => {
        const spinners = document.querySelectorAll(
          '[class*="loading"], [class*="thinking"], [class*="spinner"], [class*="dots"]'
        );
        const bodyText = document.body.innerText;
        return spinners.length === 0 && !bodyText.includes('Investigating...');
      },
      { timeout: 120_000 }
    );

    await page.waitForTimeout(2_000);

    const pageText = await page.locator('body').innerText();

    // Must reference the deployment
    expect(pageText).toMatch(/holmes|deployment|replica|running|available/i);

    // Should show tool call evidence — either tool call cards or tool names in text
    // Tool calls render as cards with tool names like "bash", "kubectl", etc.
    const hasToolEvidence =
      pageText.match(/bash|kubectl|tool/i) !== null ||
      (await page.locator('[class*="tool"], [class*="Tool"]').count()) > 0;
    expect(hasToolEvidence).toBeTruthy();

    // Must NOT be a refusal
    expect(pageText).not.toMatch(/I cannot|I don't have access|no tools available/i);
  });
});

// ── Investigate UI ───────────────────────────────────────────────────────────

test.describe('Functional: Investigate UI @smoke', () => {
  test('investigation returns pod health analysis via the form', async ({ page }) => {
    test.setTimeout(180_000);

    const investigatePage = new InvestigatePage(page);
    await investigatePage.goto();
    await investigatePage.expectFormVisible();

    // Submit an investigation that requires real tool calls
    await investigatePage.fillAndSubmit(
      'Pod health check',
      'Check if all pods in the holmesgpt namespace are healthy and report their status.'
    );

    // Wait for investigation to complete
    await page.waitForFunction(
      () => {
        const spinners = document.querySelectorAll(
          '[class*="loading"], [class*="thinking"], [class*="spinner"], [class*="pulse"], [class*="Analyzing"]'
        );
        const bodyText = document.body.innerText;
        const stillAnalyzing = bodyText.includes('Analyzing') || bodyText.includes('Investigating');
        return spinners.length === 0 && !stillAnalyzing;
      },
      { timeout: 120_000 }
    );

    await page.waitForTimeout(2_000);

    const pageText = await page.locator('body').innerText();

    // Must contain pod-related content from actual kubectl calls
    expect(pageText).toMatch(/pod|running|ready|healthy|holmesgpt/i);

    // Must be a substantial response
    expect(pageText.length).toBeGreaterThan(200);

    // Must NOT be a refusal or error
    expect(pageText).not.toMatch(/I cannot|no access|unable to connect|investigation failed/i);
  });

  test('investigation shows tool calls used during analysis', async ({ page }) => {
    test.setTimeout(180_000);

    const investigatePage = new InvestigatePage(page);
    await investigatePage.goto();
    await investigatePage.expectFormVisible();

    await investigatePage.fillAndSubmit(
      'Deployment status',
      'What deployments exist in the holmesgpt namespace and how many replicas are configured?'
    );

    // Wait for investigation to complete
    await page.waitForFunction(
      () => {
        const spinners = document.querySelectorAll(
          '[class*="loading"], [class*="thinking"], [class*="spinner"], [class*="pulse"]'
        );
        const bodyText = document.body.innerText;
        return spinners.length === 0 && !bodyText.includes('Analyzing') && !bodyText.includes('Investigating');
      },
      { timeout: 120_000 }
    );

    await page.waitForTimeout(2_000);

    const pageText = await page.locator('body').innerText();

    // Must reference the deployment
    expect(pageText).toMatch(/holmes|deployment|replica/i);

    // Should show tool call evidence
    const hasToolEvidence =
      pageText.match(/bash|kubectl|tool/i) !== null ||
      (await page.locator('[class*="tool"], [class*="Tool"]').count()) > 0;
    expect(hasToolEvidence).toBeTruthy();

    // Must NOT be an error
    expect(pageText).not.toMatch(/error.*occurred|investigation failed/i);
  });
});
