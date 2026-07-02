import { test, expect } from '@playwright/test';
import {
  attachDiagnostics,
  assertAuthSettles,
  formatDiagnostics,
  saveDiagnosticArtifacts,
} from './helpers/diagnostics';

/**
 * Environment-agnostic health checks — run against local preview, yarn dev, or production.
 * Set PLAYWRIGHT_BASE_URL or use the dev/production Playwright projects.
 */
test.describe('diagnostic', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('site is not serving Vercel NOT_FOUND', async ({ page }) => {
    const res = await page.goto('/');
    expect(res?.status(), 'homepage HTTP status').toBeLessThan(400);
    await expect(page.getByText('The page could not be found')).toHaveCount(0);
    await expect(page.locator('script[type="module"]')).toHaveCount(1, { timeout: 10_000 });
  });

  test('API health responds with ok:true', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok(), `HTTP ${res.status()}`).toBeTruthy();
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  test('homepage does not hang on auth spinner', async ({ page }, testInfo) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto('/');
    await assertAuthSettles(page, 20_000);

    const spinnerCount = await page.locator('.loading-full .spinner').count();
    expect(spinnerCount, formatDiagnostics(diagnostics)).toBe(0);

    const bodyLen = (await page.locator('body').innerText()).trim().length;
    expect(bodyLen, 'page body is empty').toBeGreaterThan(20);

    if (diagnostics.pageErrors.length || diagnostics.consoleErrors.length) {
      await saveDiagnosticArtifacts(page, testInfo, 'homepage');
    }
    expect(diagnostics.pageErrors, formatDiagnostics(diagnostics)).toEqual([]);
  });

  test('protected routes redirect to login when logged out', async ({ page }) => {
    await page.goto('/dashboard');
    await assertAuthSettles(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await assertAuthSettles(page);
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('register page renders', async ({ page }) => {
    await page.goto('/register');
    await assertAuthSettles(page);
    await expect(page.getByLabel('Display Name')).toBeVisible();
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
  });

  test('upload page reachable when using local auth', async ({ page, baseURL }) => {
    test.skip(!baseURL?.includes('127.0.0.1'), 'Supabase register flow varies — local preview only');

    const stamp = Date.now();
    await page.goto('/register');
    await page.getByLabel('Display Name').fill('Diag User');
    await page.getByLabel('Email').fill(`diag-${stamp}@example.com`);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('testpass123');
    await page.getByLabel('Confirm Password').fill('testpass123');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    await page.goto('/upload');
    await assertAuthSettles(page);
    await expect(page.getByRole('heading', { name: 'Upload Items' })).toBeVisible();
  });
});
