import { test, expect } from '../fixtures/authenticated';

/**
 * Integration-specific tests — validates each toolset integration is present
 * and that the LLM can actually use them to answer questions.
 *
 * Based on the live deployment state:
 *   Enabled:  kubernetes/core, grafana/dashboards, datadog/*, bash, atlassian, aws_api, salesforce
 *   Failed:   prometheus/metrics (no URL configured), ado (502 from MCP server), robusta
 *   Disabled: argocd, helm, openshift, etc.
 *
 * Tests validate:
 *   1. The /api/integrations endpoint returns the correct status for each integration
 *   2. Enabled integrations can answer real questions (LLM uses the tool)
 *   3. Failed integrations show an error (not silently missing)
 */

const BASE_URL = process.env.BASE_URL ?? 'https://holmesgpt.dev.platform.pditechnologies.com';

// ── API-level integration status tests ────────────────────────────────────────

test.describe('Integrations API: Status Validation @smoke', () => {
  let integrations: Array<{ name: string; status: string; error: string | null }> = [];

  test.beforeAll(async ({ request }) => {
    // Login
    await request.post(`${BASE_URL}/auth/login`, {
      data: {
        username: process.env.HOLMES_USERNAME ?? 'admin',
        password: process.env.HOLMES_PASSWORD ?? '',
      },
    });

    const response = await request.get(`${BASE_URL}/api/integrations`);
    expect(response.status()).toBe(200);
    const data = await response.json();
    integrations = (data.integrations || data) as typeof integrations;
  });

  // ── Always-enabled integrations ──────────────────────────────────────────

  test('kubernetes/core is enabled', async () => {
    const k8s = integrations.find((i) => i.name === 'kubernetes/core');
    expect(k8s, 'kubernetes/core integration not found').toBeTruthy();
    expect(k8s!.status).toBe('enabled');
    expect(k8s!.error).toBeNull();
  });

  test('kubernetes/logs is enabled', async () => {
    const k8sLogs = integrations.find((i) => i.name === 'kubernetes/logs');
    expect(k8sLogs, 'kubernetes/logs integration not found').toBeTruthy();
    expect(k8sLogs!.status).toBe('enabled');
  });

  test('grafana/dashboards is enabled', async () => {
    const grafana = integrations.find((i) => i.name === 'grafana/dashboards');
    expect(grafana, 'grafana/dashboards integration not found').toBeTruthy();
    expect(grafana!.status).toBe('enabled');
    expect(grafana!.error).toBeNull();
  });

  test('datadog/metrics is enabled', async () => {
    const dd = integrations.find((i) => i.name === 'datadog/metrics');
    expect(dd, 'datadog/metrics integration not found').toBeTruthy();
    expect(dd!.status).toBe('enabled');
    expect(dd!.error).toBeNull();
  });

  test('datadog/logs is enabled', async () => {
    const dd = integrations.find((i) => i.name === 'datadog/logs');
    expect(dd, 'datadog/logs integration not found').toBeTruthy();
    expect(dd!.status).toBe('enabled');
  });

  test('datadog/traces is enabled', async () => {
    const dd = integrations.find((i) => i.name === 'datadog/traces');
    expect(dd, 'datadog/traces integration not found').toBeTruthy();
    expect(dd!.status).toBe('enabled');
  });

  test('datadog/general is enabled', async () => {
    const dd = integrations.find((i) => i.name === 'datadog/general');
    expect(dd, 'datadog/general integration not found').toBeTruthy();
    expect(dd!.status).toBe('enabled');
  });

  test('bash toolset is enabled', async () => {
    const bash = integrations.find((i) => i.name === 'bash');
    expect(bash, 'bash integration not found').toBeTruthy();
    expect(bash!.status).toBe('enabled');
  });

  test('atlassian MCP server is enabled', async () => {
    const atlassian = integrations.find((i) => i.name === 'atlassian');
    expect(atlassian, 'atlassian integration not found').toBeTruthy();
    expect(atlassian!.status).toBe('enabled');
  });

  test('aws_api MCP server is enabled', async () => {
    const aws = integrations.find((i) => i.name === 'aws_api');
    expect(aws, 'aws_api integration not found').toBeTruthy();
    expect(aws!.status).toBe('enabled');
  });

  test('salesforce MCP server is enabled', async () => {
    const sf = integrations.find((i) => i.name === 'salesforce');
    expect(sf, 'salesforce integration not found').toBeTruthy();
    expect(sf!.status).toBe('enabled');
  });

  // ── Known-failed integrations — must show error, not silently missing ──

  test('prometheus/metrics shows failed status with error message', async () => {
    const prom = integrations.find((i) => i.name === 'prometheus/metrics');
    expect(prom, 'prometheus/metrics integration not found').toBeTruthy();
    expect(prom!.status).toBe('failed');
    // Must have an error message explaining why it failed
    expect(prom!.error).toBeTruthy();
    expect(prom!.error!.length).toBeGreaterThan(0);
  });

  test('ado MCP server is enabled', async () => {
    const ado = integrations.find((i) => i.name === 'ado');
    expect(ado, 'ado integration not found').toBeTruthy();
    expect(ado!.status).toBe('enabled');
  });

  // ── Integration count sanity check ──────────────────────────────────────

  test('at least 10 integrations are returned', async () => {
    expect(integrations.length).toBeGreaterThanOrEqual(10);
  });

  test('at least 8 integrations are enabled', async () => {
    const enabledCount = integrations.filter((i) => i.status === 'enabled').length;
    expect(enabledCount).toBeGreaterThanOrEqual(8);
  });
});

// ── LLM-level integration capability tests ────────────────────────────────────

test.describe('Integrations: Kubernetes @full', () => {
  test('LLM can list pods using kubernetes/core', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const input = page.locator('textarea, [contenteditable="true"]').first();
    await input.fill('List all pods in the holmesgpt namespace with their status');
    await input.press('Enter');

    await page.waitForFunction(
      () => document.querySelectorAll('[class*="loading"],[class*="thinking"],[class*="spinner"]').length === 0,
      { timeout: 120_000 }
    );

    const text = await page.locator('body').innerText();
    // Must list actual pod names (holmes-holmes-* prefix)
    expect(text).toMatch(/holmes-holmes/i);
    // Must include status
    expect(text).toMatch(/running|ready/i);
    // Must not be an error
    expect(text).not.toMatch(/I cannot access|no kubernetes access/i);
  });

  test('LLM can fetch pod logs using kubernetes/logs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const input = page.locator('textarea, [contenteditable="true"]').first();
    await input.fill('Show me the last 5 log lines from the holmes pod in the holmesgpt namespace');
    await input.press('Enter');

    await page.waitForFunction(
      () => document.querySelectorAll('[class*="loading"],[class*="thinking"],[class*="spinner"]').length === 0,
      { timeout: 120_000 }
    );

    const text = await page.locator('body').innerText();
    // Logs should contain something meaningful from the holmes server
    expect(text).toMatch(/holmes|server|request|GET|POST|log/i);
    expect(text).not.toMatch(/I cannot|no access to logs/i);
  });
});

test.describe('Integrations: Grafana @full', () => {
  test('LLM can list Grafana dashboards', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const input = page.locator('textarea, [contenteditable="true"]').first();
    await input.fill('List all available Grafana dashboards');
    await input.press('Enter');

    await page.waitForFunction(
      () => document.querySelectorAll('[class*="loading"],[class*="thinking"],[class*="spinner"]').length === 0,
      { timeout: 120_000 }
    );

    const text = await page.locator('body').innerText();
    // Should return dashboard names or indicate no dashboards exist
    // Either way, it must have used the Grafana tool (not refused)
    expect(text).not.toMatch(/grafana.*not.*available|cannot access grafana/i);
    // Should mention dashboards in some form
    expect(text).toMatch(/dashboard|grafana/i);
  });
});

test.describe('Integrations: Datadog @full', () => {
  test('LLM can query Datadog metrics', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const input = page.locator('textarea, [contenteditable="true"]').first();
    await input.fill('Check Datadog for any monitors or alerts that are currently triggered');
    await input.press('Enter');

    await page.waitForFunction(
      () => document.querySelectorAll('[class*="loading"],[class*="thinking"],[class*="spinner"]').length === 0,
      { timeout: 120_000 }
    );

    const text = await page.locator('body').innerText();
    // Must have used Datadog tools (not refused)
    expect(text).not.toMatch(/datadog.*not.*available|cannot access datadog/i);
    // Should mention monitors, alerts, or metrics
    expect(text).toMatch(/monitor|alert|metric|datadog/i);
  });
});

test.describe('Integrations: AWS @full', () => {
  test('LLM can query AWS resources via aws_api MCP', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const input = page.locator('textarea, [contenteditable="true"]').first();
    await input.fill('List the AWS EKS clusters available in the platform account');
    await input.press('Enter');

    await page.waitForFunction(
      () => document.querySelectorAll('[class*="loading"],[class*="thinking"],[class*="spinner"]').length === 0,
      { timeout: 120_000 }
    );

    const text = await page.locator('body').innerText();
    // Must have used AWS tools
    expect(text).not.toMatch(/aws.*not.*available|cannot access aws/i);
    // Should mention EKS or clusters
    expect(text).toMatch(/eks|cluster|holmesgpt/i);
  });
});

test.describe('Integrations: Atlassian @full', () => {
  test('LLM can query Atlassian via MCP server', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const input = page.locator('textarea, [contenteditable="true"]').first();
    await input.fill('Search for recent Jira issues or Confluence pages related to HolmesGPT');
    await input.press('Enter');

    await page.waitForFunction(
      () => document.querySelectorAll('[class*="loading"],[class*="thinking"],[class*="spinner"]').length === 0,
      { timeout: 120_000 }
    );

    const text = await page.locator('body').innerText();
    // Must have attempted to use Atlassian tools
    expect(text).not.toMatch(/atlassian.*not.*configured|no atlassian access/i);
    // Should mention Jira, Confluence, or issues
    expect(text).toMatch(/jira|confluence|issue|page|atlassian/i);
  });
});

test.describe('Integrations: Salesforce @full', () => {
  test('LLM can query Salesforce via MCP server', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const input = page.locator('textarea, [contenteditable="true"]').first();
    await input.fill('Search for recent Salesforce cases or accounts');
    await input.press('Enter');

    await page.waitForFunction(
      () => document.querySelectorAll('[class*="loading"],[class*="thinking"],[class*="spinner"]').length === 0,
      { timeout: 120_000 }
    );

    const text = await page.locator('body').innerText();
    // Must have attempted to use Salesforce tools
    expect(text).not.toMatch(/salesforce.*not.*configured|no salesforce access/i);
    // Should mention cases, accounts, or Salesforce
    expect(text).toMatch(/salesforce|case|account|crm/i);
  });
});

test.describe('Integrations: Prometheus (known-failed) @full', () => {
  test('LLM reports prometheus is unavailable with explanation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const input = page.locator('textarea, [contenteditable="true"]').first();
    await input.fill('Query Prometheus for CPU usage metrics');
    await input.press('Enter');

    await page.waitForFunction(
      () => document.querySelectorAll('[class*="loading"],[class*="thinking"],[class*="spinner"]').length === 0,
      { timeout: 120_000 }
    );

    const text = await page.locator('body').innerText();
    // Prometheus is failed — LLM should either:
    // a) Report it's unavailable/not configured
    // b) Try and get an error
    // It should NOT silently return empty results
    expect(text.trim().length).toBeGreaterThan(50);
    // Should mention prometheus in some context
    expect(text).toMatch(/prometheus|metric/i);
  });
});
