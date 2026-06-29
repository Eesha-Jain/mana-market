import { test, expect } from '@playwright/test';
import { clearAppStorage, registerAndGoTo } from './helpers/auth';

test.describe('settings page', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await registerAndGoTo(page, '/settings');
  });

  test('shows capitalization default controls', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByText('Default title format')).toBeVisible();
    await expect(page.getByText('Default description format')).toBeVisible();
    await expect(page.getByText('Text capitalization')).toBeVisible();
  });

  test('persists title case preference across reload', async ({ page }) => {
    const titleSelect = page.locator('label').filter({ hasText: 'Default title format' }).locator('select');
    await titleSelect.selectOption('upper');

    await page.reload();
    await expect(titleSelect).toHaveValue('upper');
  });

  test('persists description case preference across reload', async ({ page }) => {
    const descSelect = page.locator('label').filter({ hasText: 'Default description format' }).locator('select');
    await descSelect.selectOption('sentence');

    await page.reload();
    await expect(descSelect).toHaveValue('sentence');
  });

  test('settings are scoped per user account', async ({ page, context }) => {
    const titleSelect = page.locator('label').filter({ hasText: 'Default title format' }).locator('select');
    await titleSelect.selectOption('title');

    const page2 = await context.newPage();
    await clearAppStorage(page2);
    await registerAndGoTo(page2, '/settings');
    const titleSelect2 = page2.locator('label').filter({ hasText: 'Default title format' }).locator('select');
    await expect(titleSelect2).toHaveValue('as_detected');
    await page2.close();
  });

  test('shows default pricing controls', async ({ page }) => {
    await expect(page.getByText('Default pricing')).toBeVisible();
    await expect(page.getByText('Default pricing mode')).toBeVisible();
  });

  test('shows discount field when percent below market is selected', async ({ page }) => {
    await page.locator('label').filter({ hasText: 'Default pricing mode' }).locator('select').selectOption('percent_below');
    await expect(page.getByText('Default discount below market')).toBeVisible();
    await page.locator('label').filter({ hasText: 'Default discount below market' }).locator('input').fill('25');
    await page.reload();
    await expect(page.locator('label').filter({ hasText: 'Default discount below market' }).locator('input')).toHaveValue('25');
  });

  test('persists pricing mode across reload', async ({ page }) => {
    const pricingSelect = page.locator('label').filter({ hasText: 'Default pricing mode' }).locator('select');
    await pricingSelect.selectOption('percent_below');
    await page.reload();
    await expect(pricingSelect).toHaveValue('percent_below');
  });

  test('shows photo scan default controls', async ({ page }) => {
    await expect(page.getByText('Photo scan defaults')).toBeVisible();
    await expect(page.getByText('Default photo type')).toBeVisible();
  });

  test('persists photo capture target across reload', async ({ page }) => {
    const photoSelect = page.locator('label').filter({ hasText: 'Default photo type' }).locator('select');
    await photoSelect.selectOption('upc');
    await page.reload();
    await expect(photoSelect).toHaveValue('upc');
  });
});
