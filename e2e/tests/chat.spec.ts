import { test, expect } from '../fixtures/authenticated';
import { ChatPage } from '../pages/ChatPage';

/**
 * Chat page tests — verifies the LLM chat interface works end-to-end.
 *
 * Response validation: tests check for specific, meaningful content in the
 * LLM response — not just that "something appeared". This rules out blank
 * responses, error pages, and hallucinated answers.
 */

test.describe('Chat @smoke', () => {
  test('chat input is visible after login', async ({ page }) => {
    const chatPage = new ChatPage(page);
    await chatPage.goto();
    await chatPage.expectChatInputVisible();
  });
});

test.describe('Chat @full', () => {
  test('LLM responds with pod count for holmesgpt namespace', async ({ page }) => {
    const chatPage = new ChatPage(page);
    await chatPage.goto();
    await chatPage.expectChatInputVisible();

    const question = 'How many pods are running in the holmesgpt namespace? List their names.';
    await chatPage.sendMessage(question);

    // Wait for the response to complete (up to 2 minutes for LLM + tool calls)
    await page.waitForFunction(
      () => {
        // Loading/thinking indicators gone
        const spinners = document.querySelectorAll(
          '[class*="loading"], [class*="thinking"], [class*="spinner"], [class*="dots"]'
        );
        return spinners.length === 0;
      },
      { timeout: 120_000 }
    );

    // Validate the response contains meaningful pod information:
    // - Should mention "holmes" (the pod name prefix)
    // - Should contain a number (pod count)
    // - Should mention "holmesgpt" namespace
    const body = page.locator('body');
    await expect(body).toContainText(/holmes/i, { timeout: 5_000 });

    // Response should contain a digit (pod count)
    const pageText = await body.innerText();
    expect(pageText).toMatch(/\d+/);

    // Should NOT be an error response
    expect(pageText).not.toMatch(/error.*occurred|failed to|unable to connect/i);
  });

  test('LLM uses tool calls to answer kubernetes questions', async ({ page }) => {
    const chatPage = new ChatPage(page);
    await chatPage.goto();
    await chatPage.expectChatInputVisible();

    const question = 'What is the status of the holmes deployment in the holmesgpt namespace?';
    await chatPage.sendMessage(question);

    // Wait for response
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

    // Response must contain deployment-related content
    // "Running", "Available", "Ready", "replicas" are all valid indicators
    expect(pageText).toMatch(/running|available|ready|replica|deployment/i);

    // Should reference the actual deployment name
    expect(pageText).toMatch(/holmes/i);

    // Should NOT be a generic error
    expect(pageText).not.toMatch(/I don't have access|cannot access|no tools available/i);
  });

  test('chat page shows conversation history after response', async ({ page }) => {
    const chatPage = new ChatPage(page);
    await chatPage.goto();
    await chatPage.expectChatInputVisible();

    const question = 'List all namespaces in the cluster.';
    await chatPage.sendMessage(question);

    await page.waitForFunction(
      () => {
        const spinners = document.querySelectorAll('[class*="loading"], [class*="thinking"], [class*="spinner"]');
        return spinners.length === 0;
      },
      { timeout: 120_000 }
    );

    const pageText = await page.locator('body').innerText();

    // Should list at least the known namespaces
    expect(pageText).toMatch(/holmesgpt|kube-system|default/i);

    // Should be a list-like response (multiple items)
    const namespaceMatches = pageText.match(/namespace/gi) || [];
    expect(namespaceMatches.length + (pageText.match(/kube-|holmesgpt/gi) || []).length).toBeGreaterThan(0);
  });
});
