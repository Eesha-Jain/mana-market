import { test, expect } from '@playwright/test';
import { attachDiagnostics, assertAuthSettles, formatDiagnostics } from './helpers/diagnostics';

/** Extra checks meant only for the live Vercel deployment. */
test.describe('production deployment', () => {
  test('production bundle includes Supabase config', async ({ page }) => {
    const scripts = page.locator('script[src*="/_next/"]');
    await page.goto('/');
    await assertAuthSettles(page);

    const src = await scripts.first().getAttribute('src');
    expect(src, 'missing JS bundle').toBeTruthy();

    const res = await page.request.get(src!);
    expect(res.ok()).toBeTruthy();
    const js = await res.text();
    expect(js.includes('supabase.co'), 'Supabase URL not baked into production bundle').toBe(true);
  });

  test('search API responds on production', async ({ request }) => {
    const res = await request.get('/api/search?q=Modern+Horizons+3+Booster+Box');
    // Authenticated when Supabase is configured; unauthenticated calls return 401.
    if (res.status() === 401) {
      const json = await res.json();
      expect(json.error).toBe('Unauthorized');
      return;
    }
    expect(res.status(), await res.text()).toBeLessThan(500);
    const json = await res.json();
    expect(json.type).toBeTruthy();
  });

  test('no console errors on login page', async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto('/login');
    await assertAuthSettles(page);
    await page.waitForTimeout(1000);
    expect(diagnostics.pageErrors, formatDiagnostics(diagnostics)).toEqual([]);
    expect(diagnostics.consoleErrors, formatDiagnostics(diagnostics)).toEqual([]);
  });
});
