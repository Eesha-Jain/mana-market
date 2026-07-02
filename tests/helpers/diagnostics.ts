import { expect, type Page, type TestInfo } from '@playwright/test';

export interface PageDiagnostics {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
}

/** Attach listeners that collect console, page, and network failures for the test report. */
export function attachDiagnostics(page: Page): PageDiagnostics {
  const diagnostics: PageDiagnostics = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
  };

  page.on('console', msg => {
    if (msg.type() === 'error') diagnostics.consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => {
    diagnostics.pageErrors.push(err.message);
  });
  page.on('requestfailed', req => {
    const failure = req.failure()?.errorText ?? 'unknown';
    diagnostics.failedRequests.push(`${req.method()} ${req.url()} — ${failure}`);
  });

  return diagnostics;
}

export async function assertAuthSettles(page: Page, maxMs = 15_000) {
  await expect
    .poll(async () => page.locator('.loading-full .spinner').count(), { timeout: maxMs })
    .toBe(0);
}

export async function assertHomepageReachable(page: Page) {
  await page.goto('/');
  await assertAuthSettles(page);
  await expect(page.locator('body')).not.toBeEmpty();
}

export function formatDiagnostics(diagnostics: PageDiagnostics): string {
  const lines: string[] = [];
  if (diagnostics.pageErrors.length) {
    lines.push(`page errors: ${diagnostics.pageErrors.join(' | ')}`);
  }
  if (diagnostics.consoleErrors.length) {
    lines.push(`console errors: ${diagnostics.consoleErrors.join(' | ')}`);
  }
  if (diagnostics.failedRequests.length) {
    lines.push(`failed requests: ${diagnostics.failedRequests.join(' | ')}`);
  }
  return lines.join('\n');
}

export async function saveDiagnosticArtifacts(page: Page, testInfo: TestInfo, label: string) {
  const safe = label.replace(/[^\w-]+/g, '-');
  await page.screenshot({
    path: testInfo.outputPath(`${safe}.png`),
    fullPage: true,
  });
}
