import { test, expect } from '@playwright/test';

test.describe('smoke', () => {
  test('API health responds', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  test('homepage loads without infinite spinner', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.loading-full .spinner')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Sign in' })).toBeVisible();
  });

  test('register flow reaches dashboard', async ({ page }) => {
    const stamp = Date.now();
    await page.goto('/register');
    await page.getByLabel('Display Name').fill('Smoke User');
    await page.getByLabel('Email').fill(`smoke-${stamp}@example.com`);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('testpass123');
    await page.getByLabel('Confirm Password').fill('testpass123');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.getByText('Welcome back, Smoke User')).toBeVisible();
  });
});
