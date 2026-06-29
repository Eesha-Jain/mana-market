import { test, expect } from '@playwright/test';
import { clearAppStorage, registerUser } from './helpers/auth';

test.describe('navigation', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await registerUser(page);
  });

  test('navbar shows all main links when authenticated', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Upload', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Review' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  });

  test('highlights active nav link per route', async ({ page }) => {
    await page.goto('/upload');
    await expect(page.getByRole('link', { name: 'Upload' })).toHaveClass(/active/);

    await page.goto('/review');
    await expect(page.getByRole('link', { name: 'Review' })).toHaveClass(/active/);

    await page.goto('/settings');
    await expect(page.getByRole('link', { name: 'Settings' })).toHaveClass(/active/);
  });

  test('root redirects to dashboard when logged in', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('dashboard empty state links to upload', async ({ page }) => {
    await expect(page.getByText('No items yet')).toBeVisible();
    await page.getByRole('link', { name: 'Upload Items' }).click();
    await expect(page).toHaveURL(/\/upload/);
    await expect(page.getByRole('heading', { name: 'Upload Items' })).toBeVisible();
  });

  test('review empty state links to upload', async ({ page }) => {
    await page.goto('/review');
    await expect(page.getByText('Nothing to review yet')).toBeVisible();
    await page.getByRole('link', { name: 'Upload Items' }).click();
    await expect(page).toHaveURL(/\/upload/);
  });
});
